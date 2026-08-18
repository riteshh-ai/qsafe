import pytest
from src.engine import get_engine

@pytest.fixture(scope="module")
def engine():
    return get_engine()

def test_robustness_typos(engine):
    # Misspellings of emergency keywords
    # "earthquake" misspelled
    res1 = engine.predict("earthquke help")
    assert res1["intent"] in ["earthquake", "sos_help_request"]
    
    # "bhookamp" (earthquake in Nepali) misspelled
    res2 = engine.predict("bhukomp")
    assert res2["intent"] in ["earthquake", "fallback_unclear"]

def test_robustness_mixed_scripts_colloquialisms(engine):
    # Mixed English + Romanized Nepali + Devanagari
    res = engine.predict("please help mero ghar भत्कियो")
    assert res["source"] in ["ml", "keyword"]
    assert res["intent"] in ["earthquake", "sos_help_request", "medical_emergency"]

def test_robustness_repetitive_characters(engine):
    # Elongated words
    res = engine.predict("heeeeelp meeeeee")
    assert res["intent"] == "sos_help_request"

def test_robustness_ood(engine):
    # Out of domain queries must hit fallback_unclear
    queries = [
        "what time is the match tomorrow?",
        "how do i bake a chocolate cake?",
        "what is the meaning of life?",
        "Can you play some music?"
    ]
    for q in queries:
        res = engine.predict(q)
        assert res["intent"] == "fallback_unclear", f"Failed on OOD query: {q}"
