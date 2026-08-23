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
        self.phrase_rules = self._build_phrase_rules()
        
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

    def _build_phrase_rules(self) -> list:
        """
        Build ordered high-signal phrase rules for real-world field queries.

        Exact keyword matching is intentionally strict. These phrase rules catch
        longer messages that contain an unambiguous emergency phrase while
        avoiding broad tokens like "help" that can be ambiguous in greetings.
        """
        rules = [
            ("emergency_contact_request", [
                "ambulance number", "police number", "fire brigade number",
                "emergency contact", "helpline number", "rescue number",
                "hotline", "phone number for", "number for ambulance",
                "number for police", "number for fire",
                "aapatkalin sampark", "call police", "prahari aapatkal",
                "prahari bolau", "prahari sahayata", "health services",
                "chikitsa aapatkal", "aspatal sampark", "swasthya seva",
            ]),
            ("first_aid_query", [
                "first aid", "cpr", "resuscitation", "bandage", "treat burn",
                "sprain treatment", "choking help", "cpr instructions",
                "cpr steps", "how to stop bleeding", "stop bleeding",
                "emergency treatment", "prathamik upchar", "aapatkalin upchar",
                "chikitsa madat", "cardiopulmonary", "punarjivan",
                "ragat rokna", "ragat rokne", "ghau herachah", "patti lagane",
            ]),
            ("medical_emergency_request", [
                "need ambulance", "call ambulance", "ambulance please",
                "medical emergency", "doctor needed", "hospital needed",
                "urgent medical help", "unconscious person", "not breathing",
                "no pulse", "heart attack", "chest pain", "cardiac arrest",
                "severe bleeding", "heavy bleeding", "blood loss",
            ]),
            ("gas_leak_report", [
                "gas leak", "gas smell", "smell gas", "smell of gas",
                "cylinder leaking", "gas pipe broke", "leaking gas",
                "gas cylinder", "gas emergency", "gas explosion",
            ]),
            ("fire_incident_report", [
                "house burning", "building on fire", "on fire", "fire emergency",
                "flames visible", "smoke coming out", "smell smoke", "see fire",
                "need fire brigade", "call fire department", "fire truck needed",
                "firefighters help", "burning building", "fire blocking exit",
            ]),
            ("trapped_debris_report", [
                "trapped under debris", "stuck under rubble", "buried under building",
                "pinned under wall", "cant move", "can't move", "stuck here",
                "cant get out", "can't get out", "trapped inside", "buried alive",
                "stuck under collapsed building", "need rescue", "emergency extraction",
                "family trapped", "children stuck", "elderly buried",
                "multiple people trapped", "fasko", "dabieko", "thunieko",
                "people buried", "bhitra faskaka manis", "basinda faskaka",
                "adhivasi faskaka", "manis dabieka",
            ]),
            ("road_blockage_report", [
                "road blocked", "highway blocked", "bridge collapsed", "road cracked",
                "road damaged", "road closed", "blocked road", "blocked highway",
                "landslide", "mudslide", "alternate route", "route blocked",
                "sadak avaruddh", "rajamarg banda", "gali avaruddh",
                "marg avaruddh", "rockfall", "pahirole avaruddh",
                "sadakama bhagnaveshesh", "chattan khase", "mato khase",
                "pul kshatigrast",
            ]),
            ("power_outage_report", [
                "power outage", "no electricity", "electricity cut off",
                "power lines down", "power line down", "power restored",
                "blackout", "grid failure", "electricity gone", "no power",
                "vidyut chaina", "vidyut banda", "bijuli chaina", "bijuli gayo",
                "vidyut bipalta", "grid bipalta", "vidyut kat",
                "vidyut punarsthan", "vidyut",
            ]),
            ("building_collapse_report", [
                "building collapsed", "house collapsed", "roof caved in",
                "wall collapsed", "structure collapsed", "apartment collapsed",
                "building fell", "house fell", "roof fell", "wall fell",
                "imarat dhali", "sanrachana dhali", "bahumanjila dhali",
                "vyavasayik imarat dhali", "concrete chunks", "steel bent",
            ]),
            ("building_damage_check", [
                "cracks in wall", "structural damage", "building tilted",
                "safety inspection", "cracks appeared", "structural integrity",
                "damage assessment", "foundation damage", "wall damage",
                "is my house safe", "is my building safe", "safe to reenter",
                "safe to re enter", "safe to re-enter", "ghar surakshit",
                "imarat suraksha", "sanrachanatmak",
                "building inspection needed", "bhitrama phut", "adhar kshati",
                "imarat nirikshan", "can go inside", "structure sound",
                "imarat sthir",
            ]),
            ("family_reunification_status", [
                "found safe", "reunited", "located safely", "family reunification",
                "report found person", "person found", "family found",
                "parivar fela", "fela par", "status update family",
                "where is family", "parivar sthiti", "parivar surakshit",
                "parivar sthan", "reunification center", "reunion location",
                "gathering point", "punarmilan kendra", "parivar beththalo",
                "punarmilan sthan",
            ]),
            ("family_member_missing", [
                "missing person", "missing family", "cant find family",
                "can't find family", "cannot find family", "lost contact",
                "not reachable", "did not come home", "lost person",
                "family missing", "parivar haraeka", "priyajan haraeka",
                "parivar gum", "harayeko manis",
                "family lost", "haraeko vyakti", "haraeko manis",
                "fela parna sakidaina", "parivar khoji",
                "last seen location", "last communication",
            ]),
            ("evacuation_guidance_query", [
                "evacuate", "evacuation route", "evacuation plan",
                "evacuation instructions", "leave the building safely",
                "exit route", "safe exit", "how to evacuate",
            ]),
            ("safe_location_query", [
                "safe place", "safe zone", "evacuation point", "open ground",
                "assembly point", "nearest safe zone", "where to go for safety",
                "where should i go", "safe area",
            ]),
            ("shelter_request", [
                "temporary shelter", "relief camp", "tent camp", "need tents",
                "place to stay", "displaced", "need shelter",
            ]),
            ("food_water_request", [
                "drinking water", "food supplies", "clean water", "food distribution",
                "baby formula", "no food", "need food", "need water", "ration",
            ]),
            ("preparedness_tips_query", [
                "earthquake go bag", "emergency kit", "secure furniture",
                "preparedness tips", "earthquake drill", "family meeting point",
                "go bag", "prepare for earthquake", "safety drill",
                "disaster readiness", "safety tips", "aapad tayari",
                "aapatkalin kit", "suraksha tips", "flashlight batteries",
                "aapatkalin apurti", "torch battery", "meeting point",
                "parivar aapatkalin yojana", "sanchar yojana",
                "drop cover hold on", "safety procedure",
            ]),
            ("aftershock_information_query", [
                "aftershock", "aftershocks", "more tremors", "another earthquake",
                "second earthquake", "earthquake again", "aftershock warning",
                "aftershock update",
            ]),
            ("status_check_general", [
                "current situation", "whats happening", "what's happening",
                "status update", "latest news", "disaster status",
                "emergency status", "crisis update", "situation report",
                "area condition", "local status", "neighborhood status",
                "community situation", "safety status", "is it safe",
                "danger level", "risk assessment", "weather condition",
                "rain status", "wind status", "communication status",
                "internet status", "network available", "resource availability",
                "help available", "supplies status", "services running",
                "general information", "need details", "want to know",
                "seeking information", "vartaman sthiti", "sthiti update",
                "nabintam samachar", "sankat update",
            ]),
            ("injury_report", [
                "injured", "injury", "casualty", "bleeding", "broken arm",
                "head injury", "wound", "sprained ankle", "burned hand",
                "hurt", "gaite", "chotpat", "ghayeko",
                "critical condition", "sano ghau", "sano pida",
                "thulo ghau", "gambhir avastha", "laceration",
            ]),
        ]
        return [
            (intent, [self.preprocessor.clean(phrase) for phrase in phrases])
            for intent, phrases in rules
        ]
    
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
        
        # Normalize non-string/None input before it reaches raw-text helpers below.
        # TextPreprocessor.clean() already tolerates None/non-str, but _detect_urgency()
        # and _extract_entities() operate on the raw text and previously crashed
        # (TypeError) on None or non-str input (e.g. a JSON null body from the caller).
        if text is None or not isinstance(text, str):
            text = ""
        
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

        # Tier 1b: High-signal phrase matching inside longer field messages.
        phrase_intent = self._match_phrase_rule(cleaned_text)
        if phrase_intent:
            result["intent"] = phrase_intent
            result["confidence"] = 0.98
            result["source"] = "keyword"
            result["recommended_action"] = self._get_quick_actions(result["intent"])
            result["latency_ms"] = round((time.time() - start_time) * 1000, 2)
            return result
            
        # Tier 1c: Fuzzy keyword matching for severe typos (cutoff=0.85)
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

    def _match_phrase_rule(self, cleaned_text: str) -> Optional[str]:
        """Return the first ordered phrase-rule intent matched in cleaned_text."""
        if not cleaned_text:
            return None

        for intent, phrases in self.phrase_rules:
            for phrase in phrases:
                if phrase and self._contains_phrase(cleaned_text, phrase):
                    return intent
        return None

    @staticmethod
    def _contains_phrase(cleaned_text: str, phrase: str) -> bool:
        """Match Latin phrases on token boundaries and script phrases by containment."""
        import re

        if re.fullmatch(r"[a-z0-9 ]+", phrase):
            pattern = rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])"
            return re.search(pattern, cleaned_text) is not None
        return phrase in cleaned_text
            
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
