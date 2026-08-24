"""End-to-end routing trace across the whole pipeline.

Not a pytest module — this one needs both services up:

    .venv\\Scripts\\python -m uvicorn src.api:app --app-dir offline-nlp --port 8000
    node backend/server.js

Then:  python offline-nlp/tests/e2e_routing_check.py

For each query it reports the intent, confidence and matching tier from the
NLP microservice alongside the response card that actually reached the user
through /api/chat, so a misroute between the two is visible at a glance.

The layer-level guards live in test_response_routing.py and
backend/tests/responseRouting.test.js and need no servers.
"""
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

NLP = "http://127.0.0.1:8000/predict"
CHAT = "http://127.0.0.1:5000/api/chat"

TESTS = [
    # --- expected earthquake -------------------------------------------------
    ("EARTHQUAKE", "bhuikampa"),
    ("EARTHQUAKE", "भूकम्प"),
    ("EARTHQUAKE", "earthquake"),
    ("EARTHQUAKE", "there is an earthquake"),
    ("EARTHQUAKE", "earthquake is happening"),
    # --- ambiguous / underspecified -----------------------------------------
    ("AMBIGUOUS", "emergency kit"),
    ("AMBIGUOUS", "first aid"),
    ("AMBIGUOUS", "help"),
    ("AMBIGUOUS", "safety"),
    ("AMBIGUOUS", "emergency"),
    ("AMBIGUOUS", "what should I do"),
    ("AMBIGUOUS", "I need help"),
    # --- clearly unrelated ---------------------------------------------------
    ("UNRELATED", "hello"),
    ("UNRELATED", "hi"),
    ("UNRELATED", "thank you"),
    ("UNRELATED", "what is the weather"),
    ("UNRELATED", "tell me a joke"),
    ("UNRELATED", "python programming"),
    ("UNRELATED", "good morning"),
    # --- one representative per remaining taxonomy intent --------------------
    ("trapped_debris_report", "I am trapped under debris"),
    ("sos_help_request", "sos save me please"),
    ("medical_emergency_request", "need ambulance my father is unconscious"),
    ("injury_report", "my arm is bleeding badly"),
    ("first_aid_query", "how to stop bleeding"),
    ("fire_incident_report", "the building is on fire"),
    ("gas_leak_report", "i smell gas in the kitchen"),
    ("building_collapse_report", "our house collapsed"),
    ("building_damage_check", "cracks in wall is my house safe"),
    ("road_blockage_report", "the road is blocked by a landslide"),
    ("power_outage_report", "no electricity since morning"),
    ("family_member_missing", "my brother is missing since the quake"),
    ("family_reunification_status", "we found my family safe"),
    ("safe_location_query", "where is the nearest safe zone"),
    ("shelter_request", "we need tents and shelter"),
    ("evacuation_guidance_query", "how to evacuate safely"),
    ("food_water_request", "we need drinking water and food"),
    ("aftershock_information_query", "will there be aftershocks"),
    ("emergency_contact_request", "ambulance number please"),
    ("preparedness_tips_query", "what should I keep in an emergency bag"),
    ("status_check_general", "what is the current situation"),
    ("greeting", "namaste"),
    ("goodbye_thanks", "thanks for the help"),
    # --- confusable / near-boundary -----------------------------------------
    ("CONFUSABLE", "emergency supplies"),
    ("CONFUSABLE", "disaster kit"),
    ("CONFUSABLE", "survival kit"),
    ("CONFUSABLE", "first aid kit"),
    ("CONFUSABLE", "what do I need during a disaster"),
    # --- multilingual --------------------------------------------------------
    ("ne_dev", "आपतकालीन किट"),
    ("ne_dev", "प्राथमिक उपचार"),
    ("ne_rom", "aapatkalin kit"),
    ("ne_rom", "prathamik upchar"),
    ("ne_rom", "bhukampa aayo k garne"),
]


def post(url, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json; charset=utf-8"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


REPO_ROOT = Path(__file__).resolve().parents[2]

_DUMP_SCRIPT = """
import { EMERGENCY_SAFETY_RESPONSES, OFF_TOPIC_FALLBACKS } from './src/prompts.js';
const out = { cards: {}, offtopic: {} };
for (const [k, v] of Object.entries(EMERGENCY_SAFETY_RESPONSES))
  for (const [lang, text] of Object.entries(v)) out.cards[`${k}::${lang}`] = text;
for (const [lang, arr] of Object.entries(OFF_TOPIC_FALLBACKS))
  arr.forEach((t, i) => { out.offtopic[`offtopic_${lang}_${i}`] = t; });
process.stdout.write(JSON.stringify(out));
"""


def load_card_index():
    """Read the canonical response strings straight from backend/src/prompts.js.

    Exact identity is the only reliable way to tell which card fired: the
    greetings card and the off-topic fallbacks both contain "I am QSAFE", so
    substring matching reports the wrong one.
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", _DUMP_SCRIPT],
        cwd=REPO_ROOT / "backend", capture_output=True, text=True,
        encoding="utf-8", check=True,
    )
    dump = json.loads(proc.stdout)
    index = {}
    for key, text in dump["cards"].items():
        index[text.strip()] = "card:" + key.split("::")[0]
    for text in dump["offtopic"].values():
        index[text.strip()] = "OFF_TOPIC"
    return index


_BY_TEXT = load_card_index()


def card_of(reply):
    """Resolve which canonical response actually reached the user."""
    if not isinstance(reply, str):
        return "<non-string>"
    hit = _BY_TEXT.get(reply.strip())
    if hit:
        return hit
    if "Stay safe!" in reply or "सुरक्षित रहनुहोस्!" in reply:
        return "ACK_SHORTCIRCUIT"
    m = re.match(r"^\s*\[([^\]]+)\]", reply)
    return f"<unmapped:{m.group(1)}>" if m else f"<unmapped:{reply[:30]}>"


def main():
    rows = []
    for expected, query in TESTS:
        try:
            nlp = post(NLP, {"text": query})
        except Exception as e:  # noqa: BLE001
            nlp = {"intent": f"<ERR {e}>", "confidence": 0.0, "source": "-"}
        try:
            chat = post(CHAT, {"message": query, "selected_language": "en"})
            card = card_of(chat.get("response"))
        except Exception as e:  # noqa: BLE001
            card = f"<ERR {e}>"
        rows.append((expected, query, nlp.get("intent"), nlp.get("confidence"),
                     nlp.get("source"), card))

    w = (24, 34, 30, 7, 14, 34)
    hdr = ("EXPECTED", "INPUT", "NLP INTENT", "CONF", "TIER", "RESPONSE CARD SERVED")
    print(" | ".join(h.ljust(x) for h, x in zip(hdr, w)))
    print("-" * (sum(w) + 15))
    for r in rows:
        cells = [str(c) for c in r]
        print(" | ".join(c[:x].ljust(x) for c, x in zip(cells, w)))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
