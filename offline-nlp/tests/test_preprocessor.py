import pytest
from src.preprocessor import TextPreprocessor

def test_clean_basic_latin():
    assert TextPreprocessor.clean("Hello World") == "hello world"
    assert TextPreprocessor.clean("  emergency   Help!  ") == "emergency help"

def test_clean_devanagari():
    # 'नमस्ते' (namaste), 'भूकम्प' (earthquake)
    assert TextPreprocessor.clean("नमस्ते") == "नमस्ते"
    assert TextPreprocessor.clean("मलाई सहयोग चाहियो !!") == "मलाई सहयोग चाहियो"

def test_clean_mixed_script():
    assert TextPreprocessor.clean("help me भूकम्प गयो") == "help me भूकम्प गयो"

def test_clean_numbers():
    assert TextPreprocessor.clean("Call 911 please") == "call 911 please"

def test_clean_noise_and_punctuation():
    assert TextPreprocessor.clean("!@#$%^&*()_+{}|:\"<>?~`-=[]\\;',./") == ""
    assert TextPreprocessor.clean("help!!!") == "help"

def test_clean_empty_and_none():
    assert TextPreprocessor.clean(None) == ""
    assert TextPreprocessor.clean("") == ""
    assert TextPreprocessor.clean("    ") == ""

def test_clean_emojis():
    # Emojis should be stripped out
    assert TextPreprocessor.clean("help 🚨 😭") == "help"
    assert TextPreprocessor.clean("🚨🚨🚨") == ""

