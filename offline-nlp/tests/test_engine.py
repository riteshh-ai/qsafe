import pytest
from src.engine import IntentEngine, get_engine
import time

@pytest.fixture(scope="module")
def engine():
    return get_engine()

def test_engine_tier1_keyword(engine):
    # Tier 1: Exact keyword match
    res = engine.predict("hello")
    assert res["intent"] == "greeting"
    assert res["confidence"] == 1.0
    assert res["source"] == "keyword"
    assert res["latency_ms"] < 50.0

def test_engine_tier1_devanagari_keyword(engine):
    # Tier 1: Exact keyword match
    res = engine.predict("नमस्ते")
    assert res["intent"] == "greeting"
    assert res["confidence"] == 1.0
    assert res["source"] == "keyword"

def test_engine_tier2_ml(engine):
    # Tier 2: ML classification (not an exact keyword but model should predict)
    res = engine.predict("ghar vatyoo help garnus")
    assert res["source"] == "ml"
    assert res["intent"] == "sos_help_request" # model classifies this as sos_help_request
    assert res["confidence"] > engine.CONFIDENCE_THRESHOLD

def test_engine_tier3_fallback(engine):
    # Tier 3: Threshold fallback (gibberish or completely out of distribution)
    # The string below should have low probability for any valid intent
    res = engine.predict("what is the weather like in kathmandu tomorrow")
    assert res["source"] == "fallback"
    assert res["intent"] == "fallback_unclear"
    assert res["confidence"] < engine.CONFIDENCE_THRESHOLD

def test_engine_empty_input(engine):
    # Empty input should trigger fallback
    res = engine.predict("")
    assert res["source"] == "fallback"
    assert res["intent"] == "fallback_unclear"

def test_engine_batch_predict(engine):
    texts = ["hello", "ghar vatyoo help garnus", ""]
    results = engine.batch_predict(texts)
    assert len(results) == 3
    assert results[0]["source"] == "keyword"
    assert results[1]["source"] in ["ml", "fallback"] 
    assert results[2]["source"] == "fallback"

