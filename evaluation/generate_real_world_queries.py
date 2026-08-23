"""
Real-World Query Generator for NLP Model Evaluation

Generates realistic disaster scenario queries for each intent category
and tests them on the NLP model to create comprehensive validation datasets.
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
import sys
import random

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class RealWorldQueryGenerator:
    """Generate and test real-world disaster scenario queries."""
    
    def __init__(self, project_root: Path = None, random_seed: int = 42):
        """Initialize generator."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.engine = get_engine(project_root)
        self.evaluation_dir = Path(__file__).parent
        self.random_seed = random_seed
        random.seed(random_seed)
        
        # Define realistic query templates for each intent
        self.query_templates = self._load_query_templates()
    
    def _load_query_templates(self) -> dict:
        """Load realistic query templates for each intent."""
        return {
            'greeting': [
                "hi", "hello", "namaste", "hey there", "good morning", "good evening",
                "hi bhai", "hello didi", "namaste k cha", "hey", "hi there",
                "hello qsafe", "namaste qsafe", "hi i need help", "hello can you help me",
                "namaste malai", "hey qsafe", "hi everyone", "hello nepal",
                "namaste kasto cha", "hi this is emergency", "hello please help",
                "namaste malai help chaincha", "hey there anyone", "hi is anyone there",
                "hello i have a question", "namaste i need information", "hi qsafe nepal",
                "hello disaster response", "namaste emergency", "hi help needed",
                "hello please respond", "namaste tapaii", "hi service",
                "hello assistance", "namaste support", "hey help me",
                "hello i'm stuck", "namaste malai bachau", "hi emergency here",
                "hello disaster", "namaste bhukampa", "hey quick help",
                "hello urgent", "namaste tapaii k cha", "hi please",
                "hello thanks", "namaste dhanyabad", "hey good to see you",
                "hello available", "namaste online", "hi responding",
                "hello active", "namaste ready", "hey standing by",
                "hello waiting", "namaste prateeksha", "hi available now",
                "hello here now", "namaste yeta chan", "hey can assist",
                "hello can help", "namaste sahayata garna sakincha", "hi need info",
                "hello need information", "namaste jankari awashyak", "hey have question",
                "hello have query", "namaste prashn cha", "hi want to ask",
                "hello want to know", "namaste janna chan", "hey curious",
                "hello wondering", "namaste sanchalit", "hi interested",
                "hello concerned", "namaste chintit", "hey worried",
                "hello anxious", "namaste chinta", "hi scared",
                "hello afraid", "namaste dara", "hey nervous",
                "hello stressed", "namaste stress", "hi panic",
                "hello emergency", "namaste aapatti", "hey urgent",
                "hello critical", "namaste kritik", "hi immediate",
                "hello right now", "namamine abhi", "hey asap",
                "hello quickly", "namaste jaldi", "hi fast",
                "hello speed", "namaste gati", "hey rush",
                "hello hurry", "namamine jaldi", "hi please respond",
                "hello answer", "namaste uttar", "hey acknowledge",
                "hello confirm", "namaste sunishchit", "hi verify",
                "hello check", "namaste parikshan", "hey validate",
                "hello ensure", "namaste nishchit", "hi guarantee",
                "hello assure", "namaste vachan", "hey certain",
                "hello guarantee", "namaste nishchit", "hi confident",
                "hello sure", "namaste vishwas", "hey trust",
                "hello believe", "namaste vishwas", "hi rely",
                "hello depend", "namaste nirdhar", "hey count on",
                "hello expect", "namaste aasha", "hi hope",
                "hello wish", "namaste aasha", "hey pray",
                "hello faith", "namaste biswas", "hi believe",
                "hey have faith", "hello confidence", "namaste vishwas",
                "hi rely on you", "hello depend on you", "namaste tapaima nirdhar",
                "hey trust you", "hello believe in you", "namaste tapaima vishwas",
                "hi count on you", "hello expect from you", "namaste tapaima aasha",
                "hey hope for help", "hello wish for assistance", "namaste sahayata ko aasha",
                "hi praying for help", "hello having faith in help", "namaste sahayata ma biswas",
                "hey believing in help", "hello trusting in assistance", "namaste sahayata ma vishwas",
                "hi relying on help", "hello depending on assistance", "namaste sahayata ma nirdhar",
                "hey counting on help", "hello expecting assistance", "namaste sahayata ki aasha",
                "hi need assistance", "hello require help", "namaste sahayata awashyak",
                "hey want assistance", "hello desire help", "namaste sahayata chan",
                "hi expecting assistance", "hello anticipating help", "namaste sahayata ki aasha",
                "hey hoping for assistance", "hello wishing for help", "namaste sahayata ko aasha"
            ],
            'goodbye_thanks': [
                "thank you", "dhanyabad", "thanks", "thanks a lot", "thank you so much",
                "dhanyabad dherai", "thank you very much", "thanks for help", "thank you for assistance",
                "dhanyabad sahayata ko lagi", "thanks qsafe", "thank you qsafe", "thanks for everything",
                "thank you for your help", "dhanyabad tapaimko sahayata ko lagi", "thanks for being there",
                "thank you for support", "dhanyawaad sahayata ko lagi", "thanks for quick response",
                "thank you for information", "dhanyabad jankari ko lagi", "thanks for answering",
                "thank you for listening", "dhanyabad sunune ko lagi", "thanks for understanding",
                "thank you for caring", "dhanyabad chintan ko lagi", "thanks for concern",
                "thank you for assistance", "dhanyabad sahayata ko lagi", "thanks for help",
                "goodbye", "bye", "good bye", "bye bye", "goodbye qsafe",
                "bye qsafe", "goodbye now", "bye now", "goodbye for now", "bye for now",
                "goodbye see you", "bye see you", "goodbye take care", "bye take care",
                "goodbye stay safe", "bye stay safe", "goodbye be safe", "bye be safe",
                "ok bye", "okay bye", "ok goodbye", "okay goodbye", "ok bye bye", "okay bye bye",
                "ok thanks bye", "okay thanks bye", "ok thank you bye", "okay thank you bye",
                "that's all bye", "that's all goodbye", "that's it bye", "that's it goodbye"
            ],
            'sos_help_request': [
                "help", "help me", "help please", "help pls", "sos", "sos help",
                "emergency help", "urgent help", "need help", "i need help", "please help me",
                "malai bachau", "malai bachau please", "malai sahayata chaincha", "malai help chaincha",
                "save me", "rescue me", "please save me", "please rescue me", "save me please",
                "rescue me please", "save me now", "rescue me now", "save me immediately", "rescue me immediately",
                "help sos", "sos sos", "sos sos sos", "emergency sos", "urgent sos",
                "help emergency", "emergency emergency", "urgent urgent", "help help", "help help help",
                "someone help me", "anyone help me", "everybody help me", "please someone help me",
                "sos help me", "sos save me", "sos rescue me", "emergency help me", "urgent help me",
                "someone save me", "anyone save me", "everybody save me", "please someone save me",
                "sos rescue me", "sos save me", "sos help me", "emergency save me", "urgent save me",
                "someone rescue me", "anyone rescue me", "everybody rescue me", "please someone rescue me"
            ],
            'earthquake_occurring_report': [
                "earthquake now", "earthquake happening now", "earthquake right now", "earthquake occurring",
                "bhukampa aayo", "bhukampa aayo hai", "bhukampa aayo cha", "bhukampa chal raha hai",
                "घर हल्लियो", "भूकम्प आयो", "भूकम्प चल रहा है", "जमीन हिल रही है",
                "ground shaking", "ground moving", "earth shaking", "building shaking",
                "earthquake started", "earthquake began", "earthquake just started", "earthquake just began",
                "bhukampa suru bhayo", "bhukampa shuru hua", "bhukampa aayo abhi",
                "feel earthquake", "feeling earthquake", "i feel earthquake", "we feel earthquake",
                "bhukampa laagyo", "bhukampa mehsoos ho raha hai", "bhukampa mehsoos hua",
                "strong earthquake", "big earthquake", "major earthquake", "severe earthquake",
                "bhukampa kathin", "bhukampa bada", "bhukampa gambhir", "bhukampa sakht",
                "light earthquake", "small earthquake", "minor earthquake", "weak earthquake",
                "bhukampa halka", "bhukampa chhota", "bhukampa kamjor", "bhukampa kam",
                "earthquake magnitude", "earthquake size", "earthquake intensity", "earthquake strength",
                "bhukampa magnitude", "bhukampa size", "bhukampa intensity", "bhukampa strength",
                "how big earthquake", "how strong earthquake", "earthquake how big", "earthquake how strong",
                "bhukampa kitna bada", "bhukampa kitna sakht", "bhukampa kitna kathin",
                "earthquake duration", "how long earthquake", "earthquake how long", "bhukampa kitna lamba",
                "earthquake stopped", "earthquake ended", "earthquake finished", "earthquake over",
                "bhukampa ruk gaya", "bhukampa khatam ho gaya", "bhukampa samapt ho gaya",
                "aftershock coming", "aftershocks expected", "more earthquakes coming", "bhukampa pachhi",
                "earthquake again", "another earthquake", "second earthquake", "bhukampa phir"
            ],
            'trapped_debris_report': [
                "trapped under debris", "stuck under rubble", "buried under building", "pinned under wall",
                "पर्खालमुनि थुनिएँ", "मलाई मलिन भएको छ", "भग्नावशेषमुनि फसेको", "इमारतमुनि दबिएको",
                "debris muni thuniyo", "malai maline bhayo", "bhagnaveshesh muni fasko", "imarat muni dabieko",
                "can't move", "stuck here", "can't get out", "trapped inside", "buried alive",
                "बाहिर निस्कन सक्दिन", "यहाँ फसेको", "निस्कन सकिन", "भित्रै फसेको", "जीवित दबिएको",
                "bahar niskna sakdina", "yahan fasko", "niskna sakin", "bhitrai fasko", "jivit dabieko",
                "help i'm trapped", "rescue me please", "stuck under collapsed building", "need rescue",
                "malai bachau", "malai uttaro", "bachau malai", "uttaro malai",
                "trapped in earthquake", "stuck after earthquake", "buried in rubble", "pinned by debris",
                "भूकम्पमा फसेको", "भूकम्पपछि फसेको", "मलिनमा दबिएको", "भग्नावशेषले थुनिएको",
                "bhukampama fasko", "bhukamppachi fasko", "malinma dabieko", "bhagnavesheshle thunieko",
                "need immediate rescue", "emergency extraction", "urgent help needed", "save me now",
                "तत्काल बचाव चाहिन्छ", "आपतकालीन निकासी", "तत्काल सहायता", "अहिलै बचाउ",
                "tatkal bachav chaincha", "aapatkalin nikasi", "tatkal sahayata", "ahilai bachau",
                "family trapped", "children stuck", "elderly buried", "multiple people trapped",
                "परिवार फसेको", "बच्चा फसेको", "वृद्ध दबिएका", "धेरै मानिस फसेका"
            ],
            'medical_emergency_request': [
                "need ambulance", "call ambulance", "ambulance please", "emergency medical",
                "एम्बुलेन्स चाहियो", "एम्बुलेन्स बोलाउ", "एम्बुलेन्स कृपया", "आपतकालीन चिकित्सा",
                "ambulance chaincha", "ambulance bolau", "ambulance kripaya", "aapatkalin chikitsa",
                "medical emergency", "doctor needed", "hospital needed", "urgent medical help",
                "चिकित्सा आपतकाल", "डाक्टर चाहिन्छ", "अस्पताल चाहिन्छ", "तत्काल चिकित्सा सहायता",
                "chikitsa aapatkala", "doctor chaincha", "aspatal chaincha", "tatkal chikitsa sahayata",
                "unconscious person", "not breathing", "no pulse", "person collapsed",
                "बेहोश व्यक्ति", "सास फेर्न नसक्ने", "नाडी नभएको", "व्यक्ति ढलेको",
                "behosh vyakti", "sas pherna nasakne", "nadi nabhaeko", "vyakti dhaleko",
                "heart attack", "chest pain", "cardiac arrest", "heart failure",
                "हृदयाघात", "छातीमा पीडा", "हृदय रोकिएको", "हृदय विफलता",
                "hridayaghat", "chati ma pida", "hriday rokieko", "hriday bipalta",
                "severe bleeding", "heavy bleeding", "blood loss", "need to stop bleeding",
                "गम्भीर रगत बग्दै", "भारी रगत बग्दै", "रगत कम", "रगत रोक्नु पर्छ",
                "gambhir ragat bagdai", "bhari ragat bagdai", "ragat kam", "ragat roknu parcha",
                "broken bone", "fracture", "bone sticking out", "severe injury",
                "हाड भाँचिएको", "फ्र्याक्चर", "हाड बाहिर निस्किएको", "गम्भीर चोट",
                "had bhanchieko", "fracture", "had bahar niskieko", "gambhir chot"
            ],
            'fire_incident_report': [
                "fire", "fire emergency", "building on fire", "house burning",
                "आगो", "आगो आपतकाल", "इमारतमा आगो", "घर बल्दै",
                "aago", "aago aapatkala", "imaratma aago", "ghar baldai",
                "flames visible", "smoke coming out", "smell smoke", "see fire",
                "ज्वाला देखिन्छ", "धुवाँ निस्किँदै", "धुवाँको गन्ध", "आगो देख्न सकिन्छ",
                "jwala dekincha", "dhuwan niskindai", "dhuwan ko gandh", "aago dekhna sakincha",
                "need fire brigade", "call fire department", "fire truck needed", "firefighters help",
                "अग्निशमन चाहिन्छ", "अग्निशमन बोलाउ", "अग्निशमन गाडी", "अग्निशमनकर्मी सहायता",
                "agnishman chaincha", "agnishman bolau", "agnishman gadi", "agnishmankarmi sahayata",
                "people trapped in fire", "stuck in burning building", "can't escape fire", "fire blocking exit",
                "आगोमा फसेका मानिस", "बल्दै गरेको इमारतमा फसेका", "आगोबाट बाहिर निस्कन सकिदैन", "आगोले निस्कने बाट रोक्यो",
                "agoma faskaka manis", "baldai gareko imaratma faskaka", "agobata bahar niskna sakidaina", "agole niskne bata rokyo",
                "gas leak", "gas explosion", "smell gas", "gas emergency",
                "ग्यास लिक", "ग्यास विस्फोट", "ग्यासको गन्ध", "ग्यास आपतकाल",
                "gas leak", "gas visphot", "gas ko gandh", "gas aapatkala"
            ],
            'gas_leak_report': [
                "gas leak", "smell gas", "gas odor", "gas emergency",
                "ग्यास लिक", "ग्यासको गन्ध", "ग्यास गन्ध", "ग्यास आपतकाल",
                "gas leak", "gas ko gandh", "gas gandh", "gas aapatkala",
                "gas smell strong", "rotten egg smell", "sulfur smell", "gas odor strong",
                "ग्यासको गन्ध बलियो", "अण्डाको गन्ध", "सल्फरको गन्ध", "ग्यास गन्ध बलियो",
                "gas ko gandh baliyo", "anda ko gandh", "sulfur ko gandh", "gas gandh baliyo",
                "hissing sound", "gas hissing", "leaking sound", "gas noise",
                "हिसिसिङ आवाज", "ग्यास हिसिसिङ", "लिक आवाज", "ग्यास आवाज",
                "hissing awaz", "gas hissing", "lik awaz", "gas awaz",
                "gas pipe broken", "gas line damaged", "gas cylinder leak", "lpg leak",
                "ग्यास पाइप भाँचिएको", "ग्यास लाइन क्षतिग्रस्त", "ग्यास सिलिन्डर लिक", "एलपीजी लिक",
                "gas pipe bhanchieko", "gas line kshatigrasta", "gas cylinder leak", "lpg leak",
                "evacuate immediately", "leave area", "gas danger zone", "safe distance",
                "तुरुन्तै निस्कनु", "क्षेत्र छोड्नु", "ग्यास खतरा क्षेत्र", "सुरक्षित दुरी",
                "turuntai nisknu", "kshetr chodnu", "gas khatra kshetr", "surakshit duri"
            ],
            'building_collapse_report': [
                "building collapsed", "building fell down", "structure collapse", "house collapse",
                "इमारत ढली", "घर ढल्यो", "संरचना ढली", "भवन ढल्यो",
                "imarat dhali", "ghar dhalyo", "sanrachana dhali", "bhavan dhalyo",
                "multi-story collapse", "apartment collapse", "commercial building collapse", "office building fell",
                "बहुमञ्जिला ढली", "अपार्टमेन्ट ढल्यो", "व्यावसायिक इमारत ढली", "कार्यालय भवन ढल्यो",
                "bahumanjila dhali", "apartment dhalyo", "vyavasayik imarat dhali", "karyalaya bhavan dhalyo",
                "people trapped inside", "residents trapped", "occupants stuck", "people buried",
                "भित्र फसेका मानिस", "बासिन्दा फसेका", "अधिवासी फसेका", "मानिस दबिएका",
                "bhitra faskaka manis", "basinda faskaka", "adhivasi faskaka", "manis dabieka",
                "debris everywhere", "rubble pile", "concrete chunks", "steel bent",
                "सबैतिर भग्नावशेष", "मलिनको ढेर", "कंक्रीट टुक्रा", "स्टील बाँकिएको",
                "sabaitir bhagnaveshesh", "malin ko dher", "concrete tukra", "steel bankieko",
                "loud crash", "huge noise", "collapse sound", "building noise",
                "ठूलो आवाज", "भवन आवाज", "ढल्ने आवाज", "इमारत ध्वनि",
                "thulo awaz", "bhavan awaz", "dhalne awaz", "imarat dhvani"
            ],
            'building_damage_check': [
                "is my building safe", "building safety check", "structural integrity", "damage assessment",
                "मेरो घर सुरक्षित छ", "इमारत सुरक्षा जाँच", "संरचनात्मक अखण्डता", "क्षति मूल्यांकन",
                "mero ghar surakshit cha", "imarat suraksha janch", "sanrachanatmak akhanda", "kshati mulyankan",
                "cracks in walls", "foundation damage", "structural cracks", "building inspection needed",
                "भित्तामा फुट", "आधार क्षति", "संरचनात्मक फुट", "इमारत निरीक्षण चाहिन्छ",
                "bhitrama phut", "adhar kshati", "sanrachanatmak phut", "imarat nirikshan chaincha",
                "safe to enter", "can go inside", "building stable", "structure sound",
                "भित्र जान सुरक्षित", "भित्र जान सकिन्छ", "इमारत स्थिर", "संरचना बलियो",
                "bhitra jan surakshit", "bhitra jan sakincha", "imarat sthir", "sanrachana baliyo",
                "engineer assessment", "structural engineer", "building evaluation", "safety certification",
                "इन्जिनियर मूल्यांकन", "संरचनात्मक इन्जिनियर", "इमारत मूल्यांकन", "सुरक्षा प्रमाणीकरण",
                "engineer mulyankan", "sanrachanatmak engineer", "imarat mulyankan", "suraksha pramanikaran"
            ],
            'aftershock_information_query': [
                "aftershocks coming", "more earthquakes expected", "when will aftershocks stop", "aftershock duration",
                "पश्चभूकम्प आउँदैछ", "थप भूकम्प अपेक्षा", "पश्चभूकम्प कहिले रोक्छ", "पश्चभूकम्प अवधि",
                "pashbhukamp audaicha", "thap bhukamp apeksha", "pashbhukamp kahile rokcha", "pashbhukamp avadhi",
                "aftershock magnitude", "how strong aftershocks", "aftershock size", "aftershock intensity",
                "पश्चभूकम्प म्याग्निच्युड", "पश्चभूकम्प कति बलियो", "पश्चभूकम्प आकार", "पश्चभूकम्प तीव्रता",
                "pashbhukamp magnitude", "pashbhukamp kati baliyo", "pashbhukamp akar", "pashbhukamp tivrata",
                "aftershock timing", "when next aftershock", "aftershock frequency", "aftershock pattern",
                "पश्चभूकम्प समय", "अर्को पश्चभूकम्प कहिले", "पश्चभूकम्प आवृत्ति", "पश्चभूकम्प प्याटर्न",
                "pashbhukamp samay", "arko pashbhukamp kahile", "pashbhukamp aavritti", "pashbhukamp pattern",
                "stay safe during aftershocks", "aftershock safety", "drop cover hold on", "aftershock drill",
                "पश्चभूकम्पमा सुरक्षित रहनुहोस्", "पश्चभूकम्प सुरक्षा", "बस्नु ढाक्नु पकड्नु", "पश्चभूकम्प अभ्यास",
                "pashbhukampama surakshit rahanuhos", "pashbhukamp suraksha", "basna dhaknu pakdnu", "pashbhukamp abhyas"
            ],
            'preparedness_tips_query': [
                "earthquake preparedness", "disaster readiness", "emergency kit", "safety tips",
                "भूकम्प तयारी", "आपद तयारी", "आपतकालीन किट", "सुरक्षा टिप्स",
                "bhukamp tayari", "aapad tayari", "aapatkalin kit", "suraksha tips",
                "emergency supplies", "food water storage", "first aid kit", "flashlight batteries",
                "आपतकालीन आपूर्ति", "खाना पानी भण्डारण", "प्राथमिक उपचार किट", "टर्च ब्याट्री",
                "aapatkalin apurti", "khana pani bhandaran", "prathamik upchar kit", "torch battery",
                "family emergency plan", "meeting point", "contact information", "communication plan",
                "परिवार आपतकालीन योजना", "भेटथलो", "सम्पर्क जानकारी", "सञ्चार योजना",
                "parivar aapatkalin yojana", "beththalo", "sampark jankari", "sanchar yojana",
                "drop cover hold on", "earthquake drill", "safety procedure", "emergency response",
                "बस्नु ढाक्नु पकड्नु", "भूकम्प अभ्यास", "सुरक्षा प्रक्रिया", "आपतकालीन प्रतिक्रिया",
                "basna dhaknu pakdnu", "bhukamp abhyas", "suraksha prakriya", "aapatkalin pratikriya"
            ],
            'evacuation_guidance_query': [
                "evacuation route", "safe exit path", "emergency exit", "escape route",
                "निकासी मार्ग", "सुरक्षित निस्कने मार्ग", "आपतकालीन निस्कने", "बाहिर निस्कने मार्ग",
                "nikasi marg", "surakshit niskne marg", "aapatkalin niskne", "bahar niskne marg",
                "evacuation center", "safe zone location", "shelter location", "meeting point",
                "निकासी केन्द्र", "सुरक्षित क्षेत्र स्थान", "आश्रय स्थान", "भेटथलो",
                "nikasi kendra", "surakshit kshetr sthan", "ashray sthan", "beththalo",
                "evacuation procedures", "safety protocols", "emergency plan", "evacuation drill",
                "निकासी प्रक्रिया", "सुरक्षा प्रोटोकल", "आपतकालीन योजना", "निकासी अभ्यास",
                "nikasi prakriya", "suraksha protocol", "aapatkalin yojana", "nikasi abhyas",
                "when to evacuate", "evacuation timing", "leave now", "immediate evacuation",
                "कहिले निस्कनु", "निकासी समय", "अहिले निस्कनु", "तुरुन्तै निस्कनु",
                "kahile nisknu", "nikasi samay", "ahile nisknu", "turuntai nisknu"
            ],
            'safe_location_query': [
                "safe location", "where is safe", "safe place", "safety zone",
                "सुरक्षित स्थान", "कहाँ सुरक्षित", "सुरक्षित ठाउँ", "सुरक्षा क्षेत्र",
                "surakshit sthan", "kahan surakshit", "surakshit thau", "suraksha kshetr",
                "open space safety", "field safety", "park safety", "ground safety",
                "खुला स्थान सुरक्षा", "खेत सुरक्षा", "पार्क सुरक्षा", "जमिन सुरक्षा",
                "khula sthan suraksha", "khet suraksha", "park suraksha", "jamin suraksha",
                "building safety", "structure safety", "inside building", "outside building",
                "इमारत सुरक्षा", "संरचना सुरक्षा", "इमारत भित्र", "इमारत बाहिर",
                "imarat suraksha", "sanrachana suraksha", "imarat bhitra", "imarat bahar",
                "away from hazards", "danger zones", "risk areas", "hazardous locations",
                "खतराबाट टाढा", "खतरा क्षेत्र", "जोखिम क्षेत्र", "खतरनाक स्थान",
                "khatrabata tada", "khatra kshetr", "jokhim kshetr", "khatranak sthan"
            ],
            'shelter_request': [
                "need shelter", "shelter needed", "emergency housing", "temporary housing",
                "आश्रय चाहिन्छ", "आश्रय आवश्यक", "आपतकालीन आवास", "अस्थायी आवास",
                "ashray chaincha", "ashray awashyak", "aapatkalin awas", "asthayi awas",
                "shelter location", "where is shelter", "nearby shelter", "local shelter",
                "आश्रय स्थान", "आश्रय कहाँ छ", "नजिकै आश्रय", "स्थानीय आश्रय",
                "ashray sthan", "ashray kahan cha", "najikai ashray", "sthaniya ashray",
                "shelter capacity", "space available", "room for family", "accommodation available",
                "आश्रय क्षमता", "खाली स्थान", "परिवारको लागि", "बस्ने स्थान उपलब्ध",
                "ashray kshamata", "khali sthan", "parivar ko lagi", "basne sthan uplabdha",
                "shelter facilities", "food water available", "medical services", "sanitation facilities",
                "आश्रय सुविधा", "खाना पानी उपलब्ध", "चिकित्सा सेवा", "सरसफाई सुविधा",
                "ashray suvidha", "khana pani uplabdha", "chikitsa seva", "sarsaphai suvidha"
            ],
            'food_water_request': [
                "need food", "need water", "hungry", "thirsty",
                "खाना चाहिन्छ", "पानी चाहिन्छ", "भोक लागेको", "तिर्खा लागेको",
                "khana chaincha", "pani chaincha", "bhok lageko", "tirkha lageko",
                "food distribution", "water distribution", "relief supplies", "aid distribution",
                "खाना वितरण", "पानी वितरण", "राहत आपूर्ति", "दहायता वितरण",
                "khana vitran", "pani vitran", "rahat apurti", "sahayata vitran",
                "emergency food", "emergency water", "survival kit", "rations",
                "आपतकालीन खाना", "आपतकालीन पानी", "जीवित रहने किट", "राशन",
                "aapatkalin khana", "aapatkalin pani", "jivit rahne kit", "rashan",
                "clean water", "drinking water", "safe water", "water purification",
                "सफा पानी", "पिउने पानी", "सुरक्षित पानी", "पानी शुद्धीकरण",
                "safa pani", "piune pani", "surakshit pani", "pani shuddhikaran"
            ],
            'family_member_missing': [
                "family missing", "loved one missing", "can't find family", "family lost",
                "परिवार हराएका", "प्रियजन हराएका", "परिवार फेला पार", "परिवार गुम",
                "parivar haraeka", "priyajan haraeka", "parivar fela par", "parivar gum",
                "missing person", "lost person", "can't locate", "searching for family",
                "हराएको व्यक्ति", "हराएको मानिस", "फेला पार्न सकिदैन", "परिवार खोजी",
                "haraeko vyakti", "haraeko manis", "fela parna sakidaina", "parivar khoji",
                "report missing", "file missing report", "missing person report", "lost person report",
                "हराएको रिपोर्ट", "हराएको व्यक्ति रिपोर्ट", "हराएको मानिस रिपोर्ट", "हराएको रिपोर्ट",
                "haraeko report", "haraeko vyakti report", "haraeko manis report", "haraeko report",
                "last seen location", "where last seen", "last contact", "last communication",
                "अन्तिम पटक देखिएको स्थान", "अन्तिम पटक कहाँ देखियो", "अन्तिम सम्पर्क", "अन्तिम सञ्चार",
                "antim patak dekieko sthan", "antim patak kahan dekiyo", "antim sampark", "antim sanchar",
                "family reunion", "find family", "locate family", "family search",
                "परिवार पुनर्मिलन", "परिवार फेला पार्नु", "परिवार पत्ता लगाउनु", "परिवार खोज",
                "parivar punarmilan", "parivar fela parnu", "parivar patta lagaunu", "parivar khoj"
            ],
            'family_reunification_status': [
                "family status", "where is family", "family safe", "family location",
                "परिवार स्थिति", "परिवार कहाँ छ", "परिवार सुरक्षित", "परिवार स्थान",
                "parivar sthiti", "parivar kahan cha", "parivar surakshit", "parivar sthan",
                "reunification center", "family meeting point", "reunion location", "gathering point",
                "पुनर्मिलन केन्द्र", "परिवार भेटथलो", "पुनर्मिलन स्थान", "भेटथलो",
                "punarmilan kendra", "parivar beththalo", "punarmilan sthan", "beththalo",
                "family found", "located family", "family safe", "family alive",
                "परिवार फेला पारियो", "परिवार पत्ता लाग्यो", "परिवार सुरक्षित", "परिवार जीवित",
                "parivar fela pariyo", "parivar patta lagyo", "parivar surakshit", "parivar jivit",
                "search status", "looking for family", "search progress", "update on search",
                "खोज स्थिति", "परिवार खोजी", "खोज प्रगति", "खोज अपडेट",
                "khoj sthiti", "parivar khoji", "khoj pragati", "khoj update"
            ],
            'injury_report': [
                "injured", "hurt", "wounded", "casualty",
                "घाइते", "चोटपट", "घायेको", "घात",
                "gaite", "chotpat", "ghayeko", "ghat",
                "minor injury", "small wound", "light injury", "slight hurt",
                "सानो चोट", "सानो घाउ", "हल्को चोट", "सानो पीडा",
                "sano chot", "sano ghau", "halko chot", "sano pida",
                "severe injury", "major wound", "serious injury", "critical condition",
                "गम्भीर चोट", "ठूलो घाउ", "गम्भीर चोट", "गम्भीर अवस्थस",
                "gambhir chot", "thulo ghau", "gambhir chot", "gambhir avastha",
                "bleeding", "blood loss", "open wound", "laceration",
                "रगत बग्दै", "रगत कम", "खुला घाउ", "चीर",
                "ragat bagdai", "ragat kam", "khula ghau", "chir",
                "broken bone", "fracture", "bone injury", "skeletal injury",
                "हाड भाँचिएको", "फ्र्याक्चर", "हाड चोट", "कंकाल चोट",
                "had bhanchieko", "fracture", "had chot", "kankal chot",
                "head injury", "concussion", "brain injury", "skull fracture",
                "टाउकोमा चोट", "मस्तिष्क झड्का", "मस्तिष्क चोट", "खोपडी फ्र्याक्चर",
                "tauko ma chot", "mastishka jhadka", "mastishka chot", "khopadi fracture",
                "burn injury", "thermal burn", "chemical burn", "electrical burn",
                "जलन चोट", "ताप्क्रिय जलन", "रासायनिक जलन", "विद्युतीय जलन",
                "jalan chot", "tapkriya jalan", "rasayanik jalan", "vidyutiya jalan"
            ],
            'first_aid_query': [
                "first aid", "emergency treatment", "medical help", "injury treatment",
                "प्राथमिक उपचार", "आपतकालीन उपचार", "चिकित्सा मद्दत", "चोट उपचार",
                "prathamik upchar", "aapatkalin upchar", "chikitsa madat", "chot upchar",
                "cpr instructions", "cpr steps", "cardiopulmonary resuscitation", "cpr guide",
                "सीपीआर निर्देशन", "सीपीआर चरण", "कार्डियोपल्मोनरी पुनर्जीवन", "सीपीआर मार्गदर्शन",
                "cpr nirdeshan", "cpr charan", "cardiopulmonary punarjivan", "cpr margadarshan",
                "bleeding control", "stop bleeding", "wound care", "bandage application",
                "रगत रोक्न", "रगत रोक्ने", "घाउ हेरचाह", "पट्टी लगाउने",
                "ragat rokna", "ragat rokne", "ghau herachah", "patti lagane",
                "burn treatment", "burn care", "thermal injury", "burn first aid",
                "जलन उपचार", "जलन हेरचाह", "ताप्क्रिय चोट", "जलन प्राथमिक उपचार",
                "jalan upchar", "jalan herachah", "tapkriya chot", "jalan prathamik upchar",
                "fracture care", "broken bone treatment", "splint application", "immobilization",
                "फ्र्याक्चर हेरचाह", "हाड भाँचिएको उपचार", "स्प्लिन्ट लगाउने", "अस्थिरता",
                "fracture herachah", "had bhanchieko upchar", "splint lagane", "asthirata",
                "choking relief", "heimlich maneuver", "airway clearance", "choking first aid",
                "दम राहत", "हाइमलिच मनुभर", "श्वासनली मुक्त", "दम प्राथमिक उपचार",
                "dam rahat", "heimlich maneuver", "shwasnali mukta", "dam prathamik upchar",
                "shock treatment", "shock management", "hypothermia care", "heat stroke treatment",
                "झड्का उपचार", "झड्का व्यवस्थापन", "हाइपोथर्मिया हेरचाह", "हिट स्ट्रोक उपचार",
                "jhadka upchar", "jhadka vyavasthapan", "hypothermia herachah", "heat stroke upchar"
            ],
            'emergency_contact_request': [
                "emergency number", "helpline number", "hotline number", "emergency contact",
                "आपतकालीन नम्बर", "हेल्पलाइन नम्बर", "हटलाइन नम्बर", "आपतकालीन सम्पर्क",
                "aapatkalin number", "helpline number", "hotline number", "aapatkalin sampark",
                "police emergency", "police number", "call police", "police help",
                "प्रहरी आपतकाल", "प्रहरी नम्बर", "प्रहरी बोलाउ", "प्रहरी सहायता",
                "prahari aapatkal", "prahari number", "prahari bolau", "prahari sahayata",
                "ambulance number", "medical emergency", "hospital contact", "health services",
                "एम्बुलेन्स नम्बर", "चिकित्सा आपतकाल", "अस्पताल सम्पर्क", "स्वास्थ्य सेवा",
                "ambulance number", "chikitsa aapatkal", "aspatal sampark", "swasthya seva",
                "fire department", "fire emergency", "fire brigade", "fire services",
                "अग्निशमन विभाग", "आगो आपतकाल", "अग्निशमन", "आगो सेवा",
                "agnishman vibhag", "aago aapatkal", "agnishman", "aago seva",
                "disaster response", "emergency services", "rescue services", "relief services",
                "आपद प्रतिक्रिया", "आपतकालीन सेवा", "बचाव सेवा", "राहत सेवा",
                "aapad pratikriya", "aapatkalin seva", "bachav seva", "rahat seva",
                "government helpline", "official contact", "authority contact", "government services",
                "सरकारी हेल्पलाइन", "आधिकारिक सम्पर्क", "प्राधिकरण सम्पर्क", "सरकारी सेवा",
                "sarkari helpline", "adhikarik sampark", "pradhikaran sampark", "sarkari seva",
                "ndrrma contact", "disaster authority", "emergency management", "disaster management",
                "एनडीआरआरएमए सम्पर्क", "आपद प्राधिकरण", "आपतकालीन व्यवस्थापन", "आपद व्यवस्थापन",
                "ndrrma sampark", "aapad pradhikaran", "aapatkalin vyavasthapan", "aapad vyavasthapan"
            ],
            'power_outage_report': [
                "power outage", "electricity gone", "no power", "blackout",
                "विद्युत विद्युत गयो", "विद्युत छैन", "विद्युत बन्द", "ब्ल्याकआउट",
                "vidyut vidyut gayo", "vidyut chaina", "vidyut banda", "blackout",
                "electricity failure", "power failure", "grid failure", "power cut",
                "विद्युत विफलता", "विद्युत विफलता", "ग्रिड विफलता", "विद्युत कट",
                "vidyut bipalta", "vidyut bipalta", "grid bipalta", "vidyut kat",
                "area blackout", "neighborhood outage", "city power gone", "regional outage",
                "क्षेत्र ब्ल्याकआउट", "छिमेकी विद्युत बन्द", "शहर विद्युत गयो", "क्षेत्रीय विद्युत बन्द",
                "kshetr blackout", "chimeki vidyut banda", "shahar vidyut gayo", "kshetriya vidyut banda",
                "power restoration", "when power back", "electricity return", "power恢复",
                "विद्युत पुनर्स्थापन", "विद्युत कहिले आउँछ", "विद्युत फर्कन्छ", "विद्युत पुनर्स्थापन",
                "vidyut punarsthan", "vidyut kahile aucha", "vidyut pharkcha", "vidyut punarsthan",
                "emergency power", "generator needed", "backup power", "alternative power",
                "आपतकालीन विद्युत", "जेनेरेटर चाहिन्छ", "ब्याकअप विद्युत", "वैकल्पिक विद्युत",
                "aapatkalin vidyut", "generator chaincha", "backup vidyut", "vaikalpik vidyut",
                "electrical hazard", "downed wires", "electrical danger", "power line damage",
                "विद्युतीय खतरा", "तार खसेका", "विद्युतीय खतरा", "विद्युत लाइन क्षति",
                "vidyutiya khatra", "tar khaseka", "vidyutiya khatra", "vidyut line kshati"
            ],
            'road_blockage_report': [
                "road blocked", "highway closed", "street blocked", "path blocked",
                "सडक अवरुद्ध", "राजमार्ग बन्द", "गली अवरुद्ध", "मार्ग अवरुद्ध",
                "sadak avaruddh", "rajamarg banda", "gali avaruddh", "marg avaruddh",
                "landslide blocked", "debris on road", "rockfall", "mudslide",
                "पहिरोले अवरुद्ध", "सडकमा भग्नावशेष", "चट्टान खस्ने", "माटो खस्ने",
                "pahirole avaruddh", "sadakama bhagnaveshesh", "chattan khase", "mato khase",
                "bridge collapse", "bridge damaged", "bridge unsafe", "crossing blocked",
                "पुल ढल्यो", "पुल क्षतिग्रस्त", "पुल असुरक्षित", "पार हुन अवरुद्ध",
                "pul dhalyo", "pul kshatigrasta", "pul asurakshit", "par hun avaruddh",
                "traffic jam", "congestion", "road closed", "detour needed",
                "ट्राफिक जाम", "भीडभाड", "सडक बन्द", "वैकल्पिक मार्ग चाहिन्छ",
                "traffic jam", "bhidhad", "sadak banda", "vaikalpik marg chaincha",
                "emergency route", "access blocked", "rescue route blocked", "ambulance blocked",
                "आपतकालीन मार्ग", "पहुँच अवरुद्ध", "बचाव मार्ग अवरुद्ध", "एम्बुलेन्स अवरुद्ध",
                "aapatkalin marg", "pahunche avaruddh", "bachav marg avaruddh", "ambulance avaruddh",
                "clearing operation", "road clearing", "debris removal", "highway reopening",
                "सफाई अभियान", "सडक सफाई", "भग्नावशेश हटाउने", "राजमार्ग पुनः खुल्ने",
                "safai abhiyan", "sadak safai", "bhagnaveshesh hataune", "rajamarg punah khulne",
                "alternative route", "detour available", "alternate path", "secondary road",
                "वैकल्पिक मार्ग", "वैकल्पिक मार्ग उपलब्ध", "वैकल्पिक पथ", "माध्यमिक सडक",
                "vaikalpik marg", "vaikalpik marg uplabdha", "vaikalpik path", "madhyamik sadak"
            ],
            'status_check_general': [
                "current situation", "what's happening", "status update", "latest news",
                "वर्तमान स्थिति", "के भइरहेको छ", "स्थिति अपडेट", "नवीनतम समाचार",
                "vartaman sthiti", "ke bhiriraheko cha", "sthiti update", "nabintam samachar",
                "disaster status", "emergency status", "crisis update", "situation report",
                "आपद स्थिति", "आपतकालीन स्थिति", "संकट अपडेट", "स्थिति रिपोर्ट",
                "aapad sthiti", "aapatkalin sthiti", "sankat update", "sthiti report",
                "area condition", "local status", "neighborhood status", "community situation",
                "क्षेत्र अवस्था", "स्थानीय स्थिति", "छिमेकी स्थिति", "समुदाय स्थिति",
                "kshetr avastha", "sthaniya sthiti", "chimeki sthiti", "samuday sthiti",
                "safety status", "is it safe", "danger level", "risk assessment",
                "सुरक्षा स्थिति", "के सुरक्षित छ", "खतरा स्तर", "जोखिम मूल्यांकन",
                "suraksha sthiti", "ke surakshit cha", "khatra star", "jokhim mulyankan",
                "weather condition", "rain status", "wind status", "temperature",
                "weather अवस्था", "वर्षा स्थिति", "हावा स्थिति", "तापक्रम",
                "weather avastha", "barsha sthiti", "hawa sthiti", "tapkram",
                "communication status", "phone working", "internet status", "network available",
                "सञ्चार स्थिति", "फोन काम गर्दै", "इन्टरनेट स्थिति", "नेटवर्क उपलब्ध",
                "sanchar sthiti", "phone kaam gardai", "internet sthiti", "network uplabdha",
                "resource availability", "help available", "supplies status", "services running",
                "स्रोत उपलब्धता", "मद्दत उपलब्ध", "आपूर्ति स्थिति", "सेवा चालू",
                "srot uplabdha", "madat uplabdha", "apurti sthiti", "seva chalu",
                "timeline update", "when will end", "duration estimate", "time remaining",
                "समयरेखा अपडेट", "कहिले अन्त्य हुन्छ", "अवधि अनुमान", "बाँकी समय",
                "samayarekha update", "kahile antya huncha", "avadhi anuman", "baki samay",
                "general information", "need details", "want to know", "seeking information",
                "सामान्य जानकारी", "विवरण चाहिन्छ", "जान्न चाहन्छु", "जानकारी खोज्दै",
                "samanya jankari", "bibaran chaincha", "janna chahanhu", "jankari khojda"
            ],
            'fallback_unclear': [
                "unclear request", "don't understand", "not sure", "confused",
                "अस्पष्ट अनुरोध", "बुझ्न सकिदैन", "अनिश्चित", "अस्पष्ट",
                "aspashta anurodh", "bujhna sakidaina", "anishchit", "aspashta",
                "what do you mean", "clarify please", "explain more", "need more details",
                "तपाईं के भन्नुहुन्छ", "स्पष्ट पार्नुहोस्", "थप व्याख्या", "थप विवरण चाहिन्छ",
                "tapai ke bhannuhuncha", "spashtha parnuhos", "thap vyakhya", "thap bibaran chaincha",
                "didn't catch that", "repeat please", "say again", "not clear",
                "बुझ्न सकिन", "फेरि भन्नुहोस्", "फेरि भन्नुहोस्", "स्पष्ट छैन",
                "bujhna sakin", "pheri bhannuhos", "pheri bhannuhos", "spashta chaina",
                "garbled message", "unclear text", "typo error", "mistake in message",
                "अस्पष्ट सन्देश", "अस्पष्ट पाठ", "टाइपो त्रुटि", "सन्देशमा गल्ती",
                "aspashta sandesh", "aspashta path", "typo truti", "sandeshama galti",
                "language issue", "translation problem", "not in nepali", "not in english",
                "भाषा समस्या", "अनुवाद समस्या", "नेपालीमा छैन", "अंग्रेजीमा छैन",
                "bhasha samasya", "anuvad samasya", "nepalima chaina", "angrejima chaina",
                "off topic", "not related", "different subject", "irrelevant",
                "विषय बाहिर", "सम्बन्धित छैन", "फरक विषय", "अप्रासंगिक",
                "bishya bahira", "sambandhit chaina", "phar bishya", "aprasangik",
                "random input", "nonsense", "gibberish", "meaningless",
                "अनियमित आगत", "बकवास", "अर्थहीन", "अर्थविहीन",
                "aniyamit aagat", "bakwas", "arthhin", "arthvihin",
                "test message", "checking system", "just testing", "system check",
                "परीक्षण सन्देश", "प्रणाली जाँच", "बस परीक्षण", "प्रणाली जाँच",
                "parikshan sandesh", "pranali janch", "bas parikshan", "pranali janch",
                "hello world", "testing bot", "sample input", "example query",
                "हेलो वर्ल्ड", "बोट परीक्षण", "नमूना आगत", "उदाहरण प्रश्न",
                "hello world", "bot parikshan", "namuna aagat", "udaharan prashn"
            ]
        }
    
    def generate_queries_for_intent(self, intent: str, num_queries: int = 100) -> list:
        """Generate realistic queries for a specific intent."""
        if intent not in self.query_templates:
            print(f"Warning: No templates for intent '{intent}', using generic templates")
            return [f"i need help with {intent.replace('_', ' ')}" for _ in range(num_queries)]
        
        templates = self.query_templates[intent]
        queries = []
        
        # Generate variations
        for i in range(num_queries):
            if i < len(templates):
                queries.append(templates[i])
            else:
                # Generate variations by combining templates
                base = random.choice(templates)
                variations = [
                    base,
                    base.upper(),
                    base.lower(),
                    base + " please",
                    "please " + base,
                    base + " now",
                    base + " urgent",
                    base + " help",
                    "help " + base,
                    base + " emergency",
                    "emergency " + base,
                    base + " qsafe",
                    "qsafe " + base,
                    base + " nepal",
                    "nepal " + base
                ]
                queries.append(random.choice(variations))
        
        return queries[:num_queries]
    
    def create_validation_dataset(self) -> pd.DataFrame:
        """Create validation dataset from existing training data."""
        print("Creating validation dataset from existing data...")
        
        dataset_path = self.evaluation_dir / 'training_dataset.csv'
        df = pd.read_csv(dataset_path, encoding='utf-8')
        
        # Use existing validation split
        val_df = df[df['split'] == 'validation'].copy()
        print(f"Loaded {len(val_df)} validation samples from existing dataset")
        
        return val_df
    
    def generate_real_world_dataset(self, queries_per_intent: int = 100) -> pd.DataFrame:
        """Generate real-world queries for all intents."""
        print(f"Generating {queries_per_intent} real-world queries per intent...")
        
        all_intents = [
            'greeting', 'goodbye_thanks', 'sos_help_request', 'earthquake_occurring_report',
            'trapped_debris_report', 'medical_emergency_request', 'fire_incident_report',
            'gas_leak_report', 'building_collapse_report', 'building_damage_check',
            'aftershock_information_query', 'preparedness_tips_query', 'evacuation_guidance_query',
            'safe_location_query', 'shelter_request', 'food_water_request',
            'family_member_missing', 'family_reunification_status', 'injury_report',
            'first_aid_query', 'emergency_contact_request', 'power_outage_report',
            'road_blockage_report', 'status_check_general', 'fallback_unclear'
        ]
        
        real_world_data = []
        
        for intent in all_intents:
            queries = self.generate_queries_for_intent(intent, queries_per_intent)
            for query in queries:
                real_world_data.append({
                    'text': query,
                    'intent': intent,
                    'split': 'real_world_test',
                    'source': 'generated'
                })
        
        real_world_df = pd.DataFrame(real_world_data)
        print(f"Generated {len(real_world_df)} real-world test queries")
        
        return real_world_df
    
    def test_on_real_world_queries(self, df: pd.DataFrame) -> pd.DataFrame:
        """Test model on real-world queries."""
        print("Testing model on real-world queries...")
        
        texts = df['text'].tolist()
        results = [self.engine.predict(text) for text in texts]
        
        df = df.copy()
        df['predicted_intent'] = [r['intent'] for r in results]
        df['confidence'] = [r['confidence'] for r in results]
        df['source'] = [r['source'] for r in results]
        df['is_correct'] = df['intent'] == df['predicted_intent']
        
        return df
    
    def evaluate_performance(self, df: pd.DataFrame) -> dict:
        """Evaluate model performance on real-world queries."""
        print("Evaluating performance...")
        
        # Overall metrics
        accuracy = df['is_correct'].mean()
        total = len(df)
        correct = df['is_correct'].sum()
        errors = total - correct
        
        # Per-intent metrics
        intent_metrics = {}
        for intent in df['intent'].unique():
            intent_df = df[df['intent'] == intent]
            intent_accuracy = intent_df['is_correct'].mean()
            intent_total = len(intent_df)
            intent_correct = intent_df['is_correct'].sum()
            
            intent_metrics[intent] = {
                'accuracy': float(intent_accuracy),
                'total': int(intent_total),
                'correct': int(intent_correct),
                'errors': int(intent_total - intent_correct)
            }
        
        # Source analysis
        source_analysis = {}
        for source in df['source'].unique():
            source_df = df[df['source'] == source]
            source_accuracy = source_df['is_correct'].mean()
            source_analysis[source] = {
                'accuracy': float(source_accuracy),
                'total': int(len(source_df))
            }
        
        return {
            'overall_accuracy': float(accuracy),
            'total_samples': int(total),
            'correct_predictions': int(correct),
            'total_errors': int(errors),
            'per_intent_metrics': intent_metrics,
            'source_analysis': source_analysis
        }
    
    def generate_comprehensive_report(self, validation_df: pd.DataFrame, 
                                    real_world_df: pd.DataFrame,
                                    real_world_results: pd.DataFrame,
                                    performance: dict) -> dict:
        """Generate comprehensive evaluation report."""
        print("Generating comprehensive report...")
        
        report = {
            'timestamp': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
            'validation_dataset': {
                'samples': int(len(validation_df)),
                'intents': int(len(validation_df['intent'].unique()))
            },
            'real_world_dataset': {
                'generated_samples': int(len(real_world_df)),
                'queries_per_intent': int(len(real_world_df) / len(real_world_df['intent'].unique())),
                'intents': int(len(real_world_df['intent'].unique()))
            },
            'performance_metrics': performance,
            'worst_performing_intents': sorted(
                [(k, v['accuracy'], v['errors']) for k, v in performance['per_intent_metrics'].items()],
                key=lambda x: x[1]
            )[:5],
            'best_performing_intents': sorted(
                [(k, v['accuracy'], v['errors']) for k, v in performance['per_intent_metrics'].items()],
                key=lambda x: x[1], reverse=True
            )[:5]
        }
        
        return report
    
    def run_analysis(self, queries_per_intent: int = 100) -> dict:
        """Run complete evaluation process."""
        print("="*60)
        print("REAL-WORLD NLP MODEL EVALUATION")
        print("="*60)
        
        # Create validation dataset from existing data
        validation_df = self.create_validation_dataset()
        
        # Generate real-world queries
        real_world_df = self.generate_real_world_dataset(queries_per_intent)
        
        # Save real-world dataset
        real_world_path = self.evaluation_dir / 'real_world_queries.csv'
        real_world_df.to_csv(real_world_path, index=False, encoding='utf-8')
        print(f"[saved] Real-world queries saved to {real_world_path}")
        
        # Test on real-world queries
        real_world_results = self.test_on_real_world_queries(real_world_df)
        
        # Save results
        results_path = self.evaluation_dir / 'real_world_test_results.csv'
        real_world_results.to_csv(results_path, index=False, encoding='utf-8')
        print(f"[saved] Test results saved to {results_path}")
        
        # Evaluate performance
        performance = self.evaluate_performance(real_world_results)
        
        # Generate comprehensive report
        report = self.generate_comprehensive_report(
            validation_df, real_world_df, real_world_results, performance
        )
        
        # Save report
        report_path = self.evaluation_dir / 'evaluation_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"[saved] Evaluation report saved to {report_path}")
        
        return report
    
    def print_summary(self, report: dict):
        """Print evaluation summary."""
        print("\n" + "="*60)
        print("EVALUATION SUMMARY")
        print("="*60)
        
        print(f"\nValidation Dataset: {report['validation_dataset']['samples']} samples")
        print(f"Real-World Dataset: {report['real_world_dataset']['generated_samples']} samples")
        print(f"Queries per Intent: {report['real_world_dataset']['queries_per_intent']}")
        
        perf = report['performance_metrics']
        print(f"\n--- Overall Performance ---")
        print(f"Accuracy: {perf['overall_accuracy']:.4f}")
        print(f"Total Samples: {perf['total_samples']}")
        print(f"Correct: {perf['correct_predictions']}")
        print(f"Errors: {perf['total_errors']}")
        
        print(f"\n--- Best Performing Intents ---")
        for intent, acc, errors in report['best_performing_intents']:
            print(f"{intent}: {acc:.4f} ({errors} errors)")
        
        print(f"\n--- Worst Performing Intents ---")
        for intent, acc, errors in report['worst_performing_intents']:
            print(f"{intent}: {acc:.4f} ({errors} errors)")
        
        print("="*60)


def main():
    """Main entry point."""
    generator = RealWorldQueryGenerator()
    report = generator.run_analysis(queries_per_intent=100)
    generator.print_summary(report)
    print("\n[done] Real-world evaluation complete!")


if __name__ == '__main__':
    main()
