"""
Phase 3: Real-Time Offline Inference Engine
3-tier matching strategy: Rule (keyword) → ML (classifier) → Fallback (threshold guardrail)
Latency target: <5ms per query on CPU
"""
import time
from pathlib import Path
from typing import Dict, Optional
import pandas as pd
from .preprocessor import TextPreprocessor
from .model import ModelTrainer


class IntentEngine:
    """
    Real-time offline intent classification engine with cascading confidence tiers.
    
    Tier 1 (Rule Match):     Exact keyword matching with confidence=1.0
    Tier 2 (ML Prediction):   Logistic Regression classifier
    Tier 3 (Threshold Guard): Fallback to 'fallback_unclear' if max_prob < τ (0.40)
    
    Returns structured JSON:
    {
        "intent": str,
        "confidence": float,
        "source": "keyword" | "ml" | "fallback",
        "latency_ms": float
    }
    """
    
    CONFIDENCE_THRESHOLD = 0.40  # τ = 0.40 fallback safeguard
    FALLBACK_INTENT = "fallback_unclear"
    
    def __init__(self, project_root: Optional[Path] = None):
        """
        Initialize inference engine with pre-trained artifacts.
        
        Args:
            project_root: Path to offline-nlp directory (auto-detected if None)
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent
        
        self.project_root = project_root
        self.preprocessor = TextPreprocessor()
        
        # Load keyword dictionary
        self.keywords_dict = self._load_keywords()
        
        # Load ML artifacts
        self.vectorizer, self.model = ModelTrainer.load_model(project_root)
        
        print("✓ IntentEngine initialized with keyword rules and ML model")
    
    def _load_keywords(self) -> Dict[str, str]:
        """
        Load keyword dictionary from datasets/keywords.csv.
        
        Returns:
            dict: {keyword: intent} mapping for Tier 1 exact matching
        """
        keywords_path = self.project_root / "datasets" / "keywords.csv"
        
        if not keywords_path.exists():
            raise FileNotFoundError(f"Keywords file not found: {keywords_path}")
        
        df = pd.read_csv(keywords_path)
        
        # Preprocess keywords (lowercase, already lowercase in CSV but normalize)
        keywords_dict = {}
        for _, row in df.iterrows():
            keyword = self.preprocessor.clean(row['keyword'])
            if keyword:  # Skip empty after preprocessing
                keywords_dict[keyword] = row['intent']
        
        print(f"✓ Loaded {len(keywords_dict)} keywords from 'keywords.csv'")
        return keywords_dict
    
    def predict(self, text: str) -> Dict:
        """
        Classify input text through cascading confidence tiers.
        
        Args:
            text: Raw user input (supports multilingual)
            
        Returns:
            dict: {
                "intent": str,
                "confidence": float,
                "source": "keyword" | "ml" | "fallback",
                "latency_ms": float
            }
        """
        start_time = time.time()
        
        # Preprocess input
        cleaned_text = self.preprocessor.clean(text)
        
        # Tier 1: Exact keyword matching
        if cleaned_text in self.keywords_dict:
            latency_ms = (time.time() - start_time) * 1000
            return {
                "intent": self.keywords_dict[cleaned_text],
                "confidence": 1.0,
                "source": "keyword",
                "latency_ms": round(latency_ms, 2)
            }
        
        # Tier 2: ML Classification
        try:
            # Transform text using vectorizer
            X_vec = self.vectorizer.transform([cleaned_text])
            
            # Get prediction and probabilities
            intent = self.model.predict(X_vec)[0]
            probabilities = self.model.predict_proba(X_vec)[0]
            confidence = float(probabilities.max())
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Tier 3: Confidence threshold guardrail
            if confidence < self.CONFIDENCE_THRESHOLD:
                return {
                    "intent": self.FALLBACK_INTENT,
                    "confidence": confidence,
                    "source": "fallback",
                    "latency_ms": round(latency_ms, 2)
                }
            
            return {
                "intent": intent,
                "confidence": confidence,
                "source": "ml",
                "latency_ms": round(latency_ms, 2)
            }
        
        except Exception as e:
            # Graceful fallback on any error
            latency_ms = (time.time() - start_time) * 1000
            return {
                "intent": self.FALLBACK_INTENT,
                "confidence": 0.0,
                "source": "fallback",
                "latency_ms": round(latency_ms, 2),
                "error": str(e)
            }
    
    def batch_predict(self, texts: list) -> list:
        """
        Classify multiple texts efficiently.
        
        Args:
            texts: List of input strings
            
        Returns:
            list: List of prediction dicts
        """
        results = []
        for text in texts:
            results.append(self.predict(text))
        return results


# Singleton instance for lazy loading
_engine_instance = None


def get_engine(project_root: Optional[Path] = None) -> IntentEngine:
    """
    Get or create singleton IntentEngine instance.
    
    Args:
        project_root: Path to offline-nlp directory (auto-detected if None)
        
    Returns:
        IntentEngine: Singleton inference engine
    """
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = IntentEngine(project_root)
    return _engine_instance
