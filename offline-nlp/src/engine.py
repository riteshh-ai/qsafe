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
        "source": "keyword" | "keyword_fuzzy" | "ml" | "fallback",
        "urgency": "HIGH" | "LOW",
        "entities": dict,
        "recommended_action": str,
        "latency_ms": float
    }
    """
    
    CONFIDENCE_THRESHOLD = 0.25  # τ = 0.25 balanced threshold for 25-class multiclass inference
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
        
        print("IntentEngine initialized with keyword rules and ML model")
    
    def _load_keywords(self) -> Dict[str, str]:
        """
        Load keyword dictionary from datasets/keywords.csv.
        
        Returns:
            dict: {keyword: intent} mapping for Tier 1 exact matching
        """
        keywords_path = self.project_root / "datasets" / "keywords.csv"
        
        if not keywords_path.exists():
            raise FileNotFoundError(f"Keywords file not found: {keywords_path}")
        
        df = pd.read_csv(keywords_path, encoding='utf-8')
        
        # Preprocess keywords (lowercase, already lowercase in CSV but normalize)
        keywords_dict = {}
        for _, row in df.iterrows():
            keyword = self.preprocessor.clean(row['keyword'])
            if keyword:  # Skip empty after preprocessing
                keywords_dict[keyword] = row['intent']
        
        print(f"Loaded {len(keywords_dict)} keywords from 'keywords.csv'")
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
                "source": "keyword" | "keyword_fuzzy" | "ml" | "fallback",
                "urgency": "HIGH" | "LOW",
                "entities": dict,
                "recommended_action": str,
                "latency_ms": float
            }
        """
        start_time = time.time()
        
        # Preprocess input
        cleaned_text = self.preprocessor.clean(text)
        
        # Context Extraction
        urgency = self._detect_urgency(text, cleaned_text)
        entities = self._extract_entities(text)
        
        # Base result template
        result = {
            "intent": self.FALLBACK_INTENT,
            "confidence": 0.0,
            "source": "fallback",
            "urgency": urgency,
            "entities": entities,
            "recommended_action": None,
            "latency_ms": 0.0
        }
        
        # Tier 1a: Exact keyword matching
        if cleaned_text in self.keywords_dict:
            result["intent"] = self.keywords_dict[cleaned_text]
            result["confidence"] = 1.0
            result["source"] = "keyword"
            result["recommended_action"] = self._get_quick_actions(result["intent"])
            result["latency_ms"] = round((time.time() - start_time) * 1000, 2)
            return result
            
        # Tier 1b: Fuzzy keyword matching for severe typos (cutoff=0.85)
        import difflib
        close_matches = difflib.get_close_matches(cleaned_text, self.keywords_dict.keys(), n=1, cutoff=0.85)
        if close_matches:
            matched_keyword = close_matches[0]
            result["intent"] = self.keywords_dict[matched_keyword]
            result["confidence"] = 0.95
            result["source"] = "keyword_fuzzy"
            result["recommended_action"] = self._get_quick_actions(result["intent"])
            result["latency_ms"] = round((time.time() - start_time) * 1000, 2)
            return result
        
        # Tier 2: ML Classification
        try:
            # Transform text using vectorizer
            X_vec = self.vectorizer.transform([cleaned_text])
            
            # Get prediction and probabilities
            intent = self.model.predict(X_vec)[0]
            probabilities = self.model.predict_proba(X_vec)[0]
            confidence = float(probabilities.max())
            
            # Tier 3: Confidence threshold guardrail
            result["confidence"] = round(confidence, 4)
            if confidence >= self.CONFIDENCE_THRESHOLD:
                result["intent"] = intent
                result["source"] = "ml"
                result["recommended_action"] = self._get_quick_actions(intent)
                
            result["latency_ms"] = round((time.time() - start_time) * 1000, 2)
            return result
        
        except Exception as e:
            # Graceful fallback on any error
            result["error"] = str(e)
            result["latency_ms"] = round((time.time() - start_time) * 1000, 2)
            return result
            
    def _detect_urgency(self, raw_text: str, cleaned_text: str) -> str:
        """Heuristic urgency detection based on punctuation and strong keywords."""
        urgency_keywords = [
            # English
            "help", "trapped", "sos", "urgent", "dying", "blood", "stuck",
            "immediate", "emergency", "fire", "burning", "collapse", "rescue",
            "save", "ambulance", "unconscious", "bleeding", "crushed", "buried",
            # Romanized Nepali
            "bachau", "bachao", "maddat", "faseko", "fasiyau", "uddhar",
            # Devanagari Nepali
            "मद्दत", "बचाउ", "फसे", "उद्धार", "बचाउनुहोस्",
        ]
        if "!" in raw_text or raw_text.isupper():
            return "HIGH"
        for kw in urgency_keywords:
            if kw in cleaned_text:
                return "HIGH"
        return "LOW"
        
    def _extract_entities(self, text: str) -> dict:
        """Lightweight entity extraction for locations and headcounts."""
        import re
        entities = {}
        # Simple headcount extraction (e.g., "3 people", "5 injured")
        headcount_match = re.search(r'(\d+)\s*(people|injured|dead|stuck|trapped|jana|jana ghaite)', text, re.IGNORECASE)
        if headcount_match:
            entities["headcount"] = headcount_match.group(1)
            
        # Basic location extraction (major Nepali cities/areas)
        locations = ["kathmandu", "patan", "bhaktapur", "pokhara", "chitwan", "dharan", "butwal", "thamel", "sindhupalchok", "gorkha", "lalitpur", "ktm", "काठमाडौं", "पाटन", "भक्तपुर", "पोखरा"]
        found_locations = [loc for loc in locations if loc in text.lower()]
        if found_locations:
            entities["location"] = found_locations[0]
            
        return entities
        
    def _get_quick_actions(self, intent: str) -> str:
        """Map intent to actionable UI suggestions for the frontend."""
        ACTION_MAP = {
            # Medical / Rescue emergencies -> Ambulance (102)
            "medical_emergency_request": "show_ambulance_button",
            "sos_help_request": "show_ambulance_button",
            "trapped_debris_report": "show_ambulance_button",
            "injury_report": "show_ambulance_button",
            # Fire emergencies -> Fire Brigade (101)
            "fire_incident_report": "show_fire_button",
            "gas_leak_report": "show_fire_button",
            # Structural / Safety -> Police (100)
            "building_collapse_report": "show_police_button",
            "building_damage_check": "show_police_button",
            "road_blockage_report": "show_police_button",
            "power_outage_report": "show_police_button",
            # Earthquake -> Drop-Cover-Hold guidance
            "earthquake_occurring_report": "show_earthquake_guidance",
            # People-finding
            "family_member_missing": "show_missing_person_form",
            "family_reunification_status": "show_missing_person_form",
            # Survival needs
            "shelter_request": "show_shelter_map",
            "food_water_request": "show_relief_centers",
            "evacuation_guidance_query": "show_evacuation_routes",
            "safe_location_query": "show_shelter_map",
            # Information queries
            "first_aid_query": "show_first_aid_guide",
            "preparedness_tips_query": "show_preparedness_checklist",
            "aftershock_information_query": "show_aftershock_info",
            "emergency_contact_request": "show_emergency_contacts",
        }
        return ACTION_MAP.get(intent, None)
    
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
