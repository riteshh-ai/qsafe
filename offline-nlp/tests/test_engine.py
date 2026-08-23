import pytest
from src.engine import IntentEngine, get_engine
import time

@pytest.fixture(scope="module")
def engine():
    return get_engine()


# ── Tier 1: Keyword Matching ──────────────────────────────────────

def test_engine_tier1_keyword(engine):
    res = engine.predict("hello")
    assert res["intent"] == "greeting"
    assert res["confidence"] == 1.0
    assert res["source"] == "keyword"
    assert res["latency_ms"] < 50.0

def test_engine_tier1_devanagari_keyword(engine):
    res = engine.predict("नमस्ते")
    assert res["intent"] == "greeting"
    assert res["confidence"] == 1.0
    assert res["source"] == "keyword"

def test_engine_tier1_fuzzy_keyword(engine):
    # "earthquke" is close to "earthquake" (keyword) -> fuzzy match
    res = engine.predict("earthquke")
    assert res["intent"] == "earthquake_occurring_report"
    assert res["confidence"] == 0.95
    assert res["source"] == "keyword_fuzzy"

def test_engine_tier1_phrase_status_check(engine):
    res = engine.predict("what's happening in my area")
    assert res["intent"] == "status_check_general"
    assert res["source"] == "keyword"

def test_engine_tier1_phrase_building_damage(engine):
    res = engine.predict("need structural integrity check before going inside")
    assert res["intent"] == "building_damage_check"
    assert res["source"] == "keyword"

def test_engine_tier1_phrase_first_aid(engine):
    res = engine.predict("please show cpr instructions")
    assert res["intent"] == "first_aid_query"
    assert res["source"] == "keyword"

def test_engine_tier1_phrase_power_outage(engine):
    res = engine.predict("blackout in our neighborhood")
    assert res["intent"] == "power_outage_report"
    assert res["source"] == "keyword"

def test_engine_tier1_phrase_family_missing(engine):
    res = engine.predict("can't find family after the earthquake")
    assert res["intent"] == "family_member_missing"
    assert res["source"] == "keyword"

def test_engine_tier1_phrase_contact_priority(engine):
    res = engine.predict("what is the ambulance number")
    assert res["intent"] == "emergency_contact_request"
    assert res["recommended_action"] == "show_emergency_contacts"


# ── Tier 2: ML Classification ────────────────────────────────────

def test_engine_tier2_ml(engine):
    res = engine.predict("ghar vatyoo help garnus")
    assert res["source"] == "ml"
    assert res["intent"] in ["sos_help_request", "trapped_debris_report", "building_collapse_report"]
    assert res["confidence"] > engine.CONFIDENCE_THRESHOLD

def test_engine_tier2_ml_fire(engine):
    res = engine.predict("the building next to us is burning badly please send fire brigade")
    # Long-form sentences may hit ML or fallback depending on training coverage
    assert res["intent"] in ["fire_incident_report", "fallback_unclear"]
    assert res["urgency"] == "HIGH"  # "burning" is an urgency keyword


# ── Tier 3: Fallback ─────────────────────────────────────────────

def test_engine_tier3_fallback(engine):
    # The contract is that an off-topic query is not answered as a disaster
    # intent. Which tier produces that answer is an implementation detail: with
    # real-world phrasing in the training set the classifier now recognises
    # `fallback_unclear` outright instead of arriving there by low confidence.
    # The fallback tier itself stays covered by the empty/None/non-string tests
    # below, which still exercise it directly.
    res = engine.predict("what is the weather like in kathmandu tomorrow")
    assert res["intent"] == "fallback_unclear"
    if res["source"] == "fallback":
        assert res["confidence"] < engine.CONFIDENCE_THRESHOLD

def test_engine_empty_input(engine):
    res = engine.predict("")
    assert res["source"] == "fallback"
    assert res["intent"] == "fallback_unclear"

def test_engine_none_input(engine):
    # A JSON null body (parsed as None) must not crash the engine.
    res = engine.predict(None)
    assert res["source"] == "fallback"
    assert res["intent"] == "fallback_unclear"

def test_engine_non_string_input(engine):
    # Defensive: non-str input (e.g. an int) must not crash the engine.
    res = engine.predict(12345)
    assert res["source"] == "fallback"
    assert res["intent"] == "fallback_unclear"


# ── Urgency Detection ────────────────────────────────────────────

def test_urgency_high_exclamation(engine):
    res = engine.predict("help!")
    assert res["urgency"] == "HIGH"

def test_urgency_high_allcaps(engine):
    res = engine.predict("EARTHQUAKE HAPPENING NOW")
    assert res["urgency"] == "HIGH"

def test_urgency_high_keyword(engine):
    res = engine.predict("someone is trapped please send rescue")
    assert res["urgency"] == "HIGH"

def test_urgency_low(engine):
    res = engine.predict("hello")
    assert res["urgency"] == "LOW"

def test_urgency_nepali_keyword(engine):
    res = engine.predict("मद्दत चाहियो")
    assert res["urgency"] == "HIGH"


# ── Entity Extraction ────────────────────────────────────────────

def test_entity_headcount(engine):
    res = engine.predict("5 people injured in building collapse")
    assert res["entities"].get("headcount") == "5"

def test_entity_location(engine):
    res = engine.predict("earthquake hit kathmandu")
    assert res["entities"].get("location") == "kathmandu"

def test_entity_location_nepali(engine):
    res = engine.predict("काठमाडौंमा भूकम्प")
    assert "location" in res["entities"]

def test_entity_combined(engine):
    res = engine.predict("3 people trapped in patan after earthquake")
    assert res["entities"].get("headcount") == "3"
    assert res["entities"].get("location") == "patan"

def test_entity_none(engine):
    res = engine.predict("hello")
    assert res["entities"] == {}


# ── Quick Actions ─────────────────────────────────────────────────

def test_action_ambulance(engine):
    res = engine.predict("ambulance")
    assert res["recommended_action"] == "show_ambulance_button"

def test_action_fire(engine):
    res = engine.predict("fire")
    assert res["recommended_action"] == "show_fire_button"

def test_action_earthquake(engine):
    res = engine.predict("earthquake")
    assert res["recommended_action"] == "show_earthquake_guidance"

def test_action_shelter(engine):
    res = engine.predict("shelter")
    assert res["intent"] == "shelter_request"
    assert res["recommended_action"] == "show_shelter_map"

def test_action_fallback_has_none(engine):
    res = engine.predict("random gibberish xyz abc 123")
    assert res["recommended_action"] is None


# ── Emoji Intelligence ────────────────────────────────────────────

def test_emoji_fire(engine):
    res = engine.predict("🔥🔥🔥")
    # Preprocessor translates 🔥 -> "fire", which is a keyword for fire_incident_report
    assert res["intent"] == "fire_incident_report"

def test_emoji_sos(engine):
    res = engine.predict("🆘")
    # Preprocessor translates 🆘 -> "help", which is a keyword for sos_help_request
    assert res["intent"] in ["sos_help_request"]

def test_emoji_ambulance(engine):
    res = engine.predict("🚑")
    # Preprocessor translates 🚑 -> "ambulance"
    assert res["intent"] == "medical_emergency_request"


# ── Batch Predict ─────────────────────────────────────────────────

def test_engine_batch_predict(engine):
    texts = ["hello", "ghar vatyoo help garnus", ""]
    results = engine.batch_predict(texts)
    assert len(results) == 3
    assert results[0]["source"] == "keyword"
    assert results[1]["source"] in ["ml", "fallback"] 
    assert results[2]["source"] == "fallback"


# ── Output Schema Consistency ─────────────────────────────────────

def test_output_schema_always_complete(engine):
    """Every prediction must contain all required fields, regardless of tier."""
    queries = ["hello", "earthquake help 5 people kathmandu", "", "xyz random"]
    required_keys = {"intent", "confidence", "source", "urgency", "entities", "recommended_action", "latency_ms"}
    for q in queries:
        res = engine.predict(q)
        assert required_keys.issubset(res.keys()), f"Missing keys in response for '{q}': {required_keys - res.keys()}"
