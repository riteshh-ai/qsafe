"""Response-routing regression suite (intent layer).

Companion to backend/tests/responseRouting.test.js, which covers the
intent-to-card table. This half pins the classifier's behaviour on the corpus
that exposed the "emergency kit" -> EARTHQUAKE bug, so a future dataset or
threshold change cannot quietly reintroduce it.

Runs fully in-process: no microservice, no backend, no network.
"""
import re
from pathlib import Path

import pandas as pd
import pytest

from src.engine import get_engine

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET = REPO_ROOT / "offline-nlp" / "datasets" / "training_dataset.csv"
JS_SUITE = REPO_ROOT / "backend" / "tests" / "responseRouting.test.js"

# Intents that assert a specific disaster is under way. An ambiguous or
# underspecified query must never land on one of these.
SPECIFIC_DISASTER_INTENTS = {
    "earthquake_occurring_report",
    "fire_incident_report",
    "gas_leak_report",
    "building_collapse_report",
    "trapped_debris_report",
    "road_blockage_report",
}


@pytest.fixture(scope="module")
def engine():
    return get_engine()


# ── Taxonomy contract ─────────────────────────────────────────────────

def test_taxonomy_matches_training_dataset():
    """The 25 trained intents are the domain definition; nothing else exists."""
    df = pd.read_csv(DATASET, encoding="utf-8")
    assert len(set(df["intent"])) == 25


def test_js_suite_taxonomy_matches_dataset():
    """Backend routing tests hardcode the taxonomy; keep both ends in step."""
    df = pd.read_csv(DATASET, encoding="utf-8")
    js = JS_SUITE.read_text(encoding="utf-8")
    block = re.search(r"const TAXONOMY = \[(.*?)\];", js, re.S)
    assert block, "TAXONOMY array not found in responseRouting.test.js"
    js_intents = set(re.findall(r"'([a-z_]+)'", block.group(1)))
    assert js_intents == set(df["intent"]), (
        "backend/tests/responseRouting.test.js TAXONOMY has drifted from the dataset"
    )


# ── Definite matches ──────────────────────────────────────────────────

@pytest.mark.parametrize("query,expected", [
    ("earthquake", "earthquake_occurring_report"),
    ("भूकम्प", "earthquake_occurring_report"),
    ("bhuikampa", "earthquake_occurring_report"),
    ("there is an earthquake", "earthquake_occurring_report"),
    ("earthquake is happening", "earthquake_occurring_report"),
    ("I am trapped under debris", "trapped_debris_report"),
    ("the building is on fire", "fire_incident_report"),
    ("i smell gas in the kitchen", "gas_leak_report"),
    ("our house collapsed", "building_collapse_report"),
    ("how to stop bleeding", "first_aid_query"),
    ("no electricity since morning", "power_outage_report"),
    ("where is the nearest safe zone", "safe_location_query"),
    ("we need tents and shelter", "shelter_request"),
    ("how to evacuate safely", "evacuation_guidance_query"),
    ("will there be aftershocks", "aftershock_information_query"),
    ("ambulance number please", "emergency_contact_request"),
])
def test_definite_matches(engine, query, expected):
    assert engine.predict(query)["intent"] == expected


# ── The reported bug ──────────────────────────────────────────────────

def test_emergency_kit_is_preparedness_not_earthquake(engine):
    """REGRESSION: "emergency kit" was answered with the earthquake protocol.

    The classifier was never at fault — it is an exact keyword hit. Pin that,
    so the diagnosis stays visible if the symptom ever returns.
    """
    res = engine.predict("emergency kit")
    assert res["intent"] == "preparedness_tips_query"
    assert res["confidence"] == 1.0
    assert res["source"] == "keyword"


@pytest.mark.parametrize("query", [
    "emergency kit",
    "emergency supplies",
    "disaster kit",
    "what should I keep in an emergency bag",
    "आपतकालीन किट",
    "aapatkalin kit",
    "earthquake go bag",
])
def test_kit_queries_never_classify_as_a_disaster_in_progress(engine, query):
    assert engine.predict(query)["intent"] not in SPECIFIC_DISASTER_INTENTS


# ── Ambiguous / underspecified ────────────────────────────────────────

@pytest.mark.parametrize("query", ["help", "I need help", "emergency", "safety",
                                   "what should I do", "what do I need during a disaster"])
def test_ambiguous_queries_do_not_claim_a_specific_disaster(engine, query):
    """An underspecified query must not be resolved into a named disaster.

    "help" is a real distress signal and classifies as sos_help_request, but the
    user has named no hazard — so it must not come back as "you are trapped
    under debris" or "there is a fire".
    """
    assert engine.predict(query)["intent"] not in SPECIFIC_DISASTER_INTENTS


# ── Unknown / out of domain ───────────────────────────────────────────

@pytest.mark.parametrize("query", ["what is the weather", "tell me a joke",
                                   "python programming", "who won the match"])
def test_unsupported_queries_reach_the_unclear_intent(engine, query):
    assert engine.predict(query)["intent"] == "fallback_unclear"


def test_threshold_guard_engages_below_tau(engine):
    """A sub-threshold prediction is reported as unclear, not as its argmax."""
    res = engine.predict("python programming")
    assert res["confidence"] < engine.CONFIDENCE_THRESHOLD
    assert res["source"] == "fallback"
    assert res["intent"] == "fallback_unclear"


@pytest.mark.parametrize("query", [
    "asdkjh qweoiu zxcmnb", "xyzzy", "aaaaaaa bbbbbb", "python programming",
    "tell me a joke", "what is the weather",
])
def test_no_confident_intent_survives_below_threshold(engine, query):
    """Whichever tier answers, a low-confidence result never keeps its argmax.

    This is the guardrail that stops an unrelated query from being handed a
    specific disaster protocol on a weak signal.
    """
    res = engine.predict(query)
    if res["confidence"] < engine.CONFIDENCE_THRESHOLD:
        assert res["intent"] == "fallback_unclear"
        assert res["source"] == "fallback"
    assert res["intent"] not in SPECIFIC_DISASTER_INTENTS


def test_empty_and_invalid_input_are_safe(engine):
    for bad in ["", "   ", None, 12345]:
        assert engine.predict(bad)["intent"] == "fallback_unclear"


# ── Confusable / near-boundary ────────────────────────────────────────

@pytest.mark.parametrize("query,expected", [
    ("first aid", "first_aid_query"),
    ("first aid kit", "first_aid_query"),
    ("survival kit", "food_water_request"),
    ("we need drinking water and food", "food_water_request"),
])
def test_confusable_queries(engine, query, expected):
    assert engine.predict(query)["intent"] == expected


def test_greeting_is_not_a_distress_signal(engine):
    for query in ["hello", "hi", "namaste", "good morning"]:
        assert engine.predict(query)["intent"] == "greeting"


# ── Multilingual ──────────────────────────────────────────────────────

@pytest.mark.parametrize("query,expected", [
    # Devanagari
    ("भूकम्प", "earthquake_occurring_report"),
    ("आपतकालीन किट", "preparedness_tips_query"),
    ("प्राथमिक उपचार", "first_aid_query"),
    ("नमस्ते", "greeting"),
    # Romanized Nepali
    ("bhuikampa", "earthquake_occurring_report"),
    ("aapatkalin kit", "preparedness_tips_query"),
    ("prathamik upchar", "first_aid_query"),
    # Code-switched
    ("bhukampa aayo k garne", "earthquake_occurring_report"),
])
def test_multilingual_parity(engine, query, expected):
    assert engine.predict(query)["intent"] == expected


def test_script_variants_of_one_concept_agree(engine):
    """English, Devanagari and Romanized forms of "emergency kit" must agree."""
    intents = {
        engine.predict(q)["intent"]
        for q in ("emergency kit", "आपतकालीन किट", "aapatkalin kit")
    }
    assert intents == {"preparedness_tips_query"}
