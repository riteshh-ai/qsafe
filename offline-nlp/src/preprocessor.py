"""
Phase 1: Text Preprocessing & Normalization
Handles multilingual text (English, Devanagari Nepali, Romanized Nepali)
Normalizes to lowercase, removes noise, retains alphanumeric + script characters
"""
import re
from typing import Optional


class TextPreprocessor:
    """
    Preprocesses text for multilingual intent classification.
    
    Supports:
    - Latin letters (a-z)
    - Devanagari script (U+0900–U+097F)
    - Digits (0-9)
    - Romanized Nepali (preserved as Latin)
    - Removes noise punctuation while retaining word boundaries
    """
    
    @staticmethod
    def clean(text: Optional[str]) -> str:
        """
        Normalize text input: lowercase, strip whitespace, remove noise.
        
        Args:
            text: Raw input text (can be None or non-string)
            
        Returns:
            Cleaned text string, empty string if input is invalid
        """
        # Handle non-string, None, or empty inputs
        if text is None or not isinstance(text, str):
            return ""
        
        if not text.strip():
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Retain: Latin letters [a-z], Devanagari [U+0900–U+097F], digits [0-9], spaces
        # Pattern explanation:
        # \u0900-\u097F = Devanagari script range
        # a-z = Latin letters (already lowercase)
        # 0-9 = Digits
        # \s = Whitespace (spaces, tabs, newlines)
        text = re.sub(r"[^a-z0-9\u0900-\u097F\s]", "", text)
        
        # Collapse multiple consecutive whitespaces into single space
        text = re.sub(r"\s+", " ", text)
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        return text
