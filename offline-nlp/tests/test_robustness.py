import pytest
from src.engine import get_engine

@pytest.fixture(scope="module")
def engine():
    return get_engine()


# ── Typo Resilience ──────────────────────────────────────────────

def test_robustness_typo_earthquake(engine):
    res = engine.predict("earthquke help")
    assert res["intent"] in ["earthquake_occurring_report", "sos_help_request"]

def test_robustness_typo_nepali(engine):
    # "bhookamp" misspelling - may be caught by ML or fall back
    res = engine.predict("bhukomp")
    assert res["intent"] in ["earthquake_occurring_report", "fallback_unclear"]

def test_robustness_typo_ambulance(engine):
    res = engine.predict("amblance")
    assert res["intent"] in ["medical_emergency_request", "sos_help_request", "fallback_unclear"]

def test_robustness_typo_emergency(engine):
    res = engine.predict("emrgency")
    assert res["intent"] in ["sos_help_request", "medical_emergency_request", "fallback_unclear"]


# ── Mixed Scripts & Colloquialisms ────────────────────────────────

def test_robustness_mixed_scripts(engine):
    res = engine.predict("please help mero ghar भत्कियो")
    assert res["source"] in ["ml", "keyword", "keyword_fuzzy"]
    assert res["intent"] in ["earthquake_occurring_report", "sos_help_request", "building_collapse_report", "trapped_debris_report"]

def test_robustness_romanized_nepali(engine):
    res = engine.predict("mero ghar bhatkiyo bachau")
    assert res["urgency"] == "HIGH"  # "bachau" contains "बचाउ" semantically


# ── Elongated / Panic Typing ──────────────────────────────────────

def test_robustness_elongated_words(engine):
    res = engine.predict("heeeeelp meeeeee")
    assert res["intent"] in ["sos_help_request", "fallback_unclear"]

def test_robustness_allcaps_panic(engine):
    res = engine.predict("HELP ME EARTHQUAKE BUILDING FALLING")
    assert res["urgency"] == "HIGH"


# ── Out-of-Domain (OOD) Must Fallback ─────────────────────────────

def test_robustness_ood_queries(engine):
    queries = [
        "what time is the match tomorrow?",
        "how do i bake a chocolate cake?",
        "what is the meaning of life?",
        "Can you play some music?",
        "tell me a joke",
        "who won the world cup",
    ]
    for q in queries:
        res = engine.predict(q)
        assert res["intent"] == "fallback_unclear", f"OOD query '{q}' incorrectly classified as '{res['intent']}'"
        assert res["urgency"] == "LOW", f"OOD query '{q}' incorrectly flagged as HIGH urgency"


# ── Emoji-Based Emergency Queries ─────────────────────────────────

def test_robustness_emoji_fire(engine):
    res = engine.predict("🔥 my house is on fire")
    assert res["intent"] in ["fire_incident_report"]
    assert res["urgency"] == "HIGH"

def test_robustness_emoji_medical(engine):
    res = engine.predict("🚑 someone is unconscious")
    assert res["intent"] in ["medical_emergency_request", "sos_help_request"]

def test_robustness_emoji_only(engine):
    res = engine.predict("🆘🚨")
    assert res["intent"] in ["sos_help_request"]
    assert res["urgency"] == "HIGH"


# ── Context Preservation Under Stress ─────────────────────────────

def test_robustness_entities_under_noise(engine):
    res = engine.predict("!!!! 10 people stuck kathmandu help!!!!")
    assert res["entities"].get("headcount") == "10"
    assert res["entities"].get("location") == "kathmandu"
    assert res["urgency"] == "HIGH"

def test_robustness_entity_extraction_with_typos(engine):
    res = engine.predict("5 people injurd in pokhara earthquke")
    assert res["entities"].get("location") == "pokhara"
