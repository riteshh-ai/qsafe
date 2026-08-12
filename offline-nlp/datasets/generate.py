#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QSAFE Nepal - NLP dataset generator.
Generates realistic, non-duplicate multilingual (EN / NE-Unicode / Roman-Nepali+EN mixed)
user-utterance datasets for intent classification, plus keyword and metadata files.

Design notes:
- We build each intent's data from a combinatorial template engine (slot-filling) so that
  thousands of GENUINELY DIFFERENT sentences can be produced without inventing facts or
  padding with repeats. Templates encode realistic noisy user behaviour: panic typing,
  missing punctuation, spelling mistakes, abbreviations, code-mixing, voice-transcription
  run-ons, incomplete sentences.
- After generation we deduplicate exactly (case/whitespace-normalized) and, if an intent's
  pool is smaller than its target quota, we take everything available rather than
  duplicate rows to hit a round number (documented in README/dataset_sources).
"""
import csv
import random
import itertools
import os

random.seed(42)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# 1. INTENT DEFINITIONS (used across templates + intents.md + keywords)
# ---------------------------------------------------------------------------
INTENTS = [
    "greeting",
    "goodbye_thanks",
    "sos_help_request",
    "earthquake_occurring_report",
    "trapped_debris_report",
    "medical_emergency_request",
    "injury_report",
    "fire_incident_report",
    "gas_leak_report",
    "building_collapse_report",
    "building_damage_check",
    "safe_location_query",
    "shelter_request",
    "evacuation_guidance_query",
    "family_member_missing",
    "family_reunification_status",
    "food_water_request",
    "first_aid_query",
    "aftershock_information_query",
    "emergency_contact_request",
    "power_outage_report",
    "road_blockage_report",
    "preparedness_tips_query",
    "status_check_general",
    "fallback_unclear",
]

assert len(INTENTS) == 25

# ---------------------------------------------------------------------------
# 2. SHARED SLOT VOCABULARIES
# ---------------------------------------------------------------------------
LOCATIONS_EN = ["Kathmandu", "Bhaktapur", "Lalitpur", "Pokhara", "Gorkha", "Jajarkot",
                "Dharan", "Butwal", "Chitwan", "Biratnagar", "Sindhupalchok", "Nuwakot",
                "the school", "my hostel", "our village", "the market area", "near the temple",
                "the apartment building", "downtown", "my office"]
LOCATIONS_NE = ["काठमाडौं", "भक्तपुर", "ललितपुर", "पोखरा", "गोर्खा", "जाजरकोट", "धरान",
                "बुटवल", "चितवन", "विराटनगर", "सिन्धुपाल्चोक", "नुवाकोट", "स्कूल नजिकै",
                "होस्टलमा", "गाउँमा", "बजार क्षेत्रमा", "मन्दिर नजिकै", "अपार्टमेन्टमा",
                "सहरको बीचमा", "अफिसमा"]
FAMILY_EN = ["my mother", "my father", "my brother", "my sister", "my grandmother",
             "my grandfather", "my son", "my daughter", "my neighbor", "my friend",
             "my wife", "my husband", "my cousin", "my roommate", "my aunt", "my uncle"]
FAMILY_NE = ["आमा", "बुबा", "दाजु", "दिदी", "हजुरआमा", "हजुरबुबा", "छोरा", "छोरी",
             "छिमेकी", "साथी", "श्रीमती", "श्रीमान", "काका", "साथी दिदी", "फुपू", "मामा"]
TIME_EN = ["just now", "5 minutes ago", "an hour ago", "this morning", "last night",
           "right now", "a few seconds ago"]
TIME_NE = ["भर्खरै", "५ मिनेट अगाडि", "एक घण्टा अगाडि", "आज बिहान", "हिजो राति",
           "अहिले", "केही सेकेण्ड अगाडि"]

TYPO_SUFFIXES = ["", " pls", " plz", " asap", " help!!", "???", "!!", " urgent", " now"]

def dedupe_keep_order(rows):
    seen = set()
    out = []
    for text, intent in rows:
        key = " ".join(text.strip().lower().split())
        if key and key not in seen:
            seen.add(key)
            out.append((text.strip(), intent))
    return out


# ---------------------------------------------------------------------------
# 3. TEMPLATE FUNCTIONS PER INTENT, PER LANGUAGE
#    Each returns a list of (text, intent) tuples.
# ---------------------------------------------------------------------------

def add_noise_en(s, i):
    """Deterministic pseudo-random noise based on index for variety, not randomness at call time issues."""
    variants = [s, s.lower(), s.capitalize(), s + random.choice(TYPO_SUFFIXES)]
    return variants[i % len(variants)]

# ---- GREETING ----
def gen_greeting_en():
    base = ["hi", "hello", "hey", "hii", "helo", "good morning", "good evening",
            "namaste", "hello there", "hey QSAFE", "hi bot", "yo", "hlo", "hey there",
            "good afternoon", "hiii", "hello sir", "hello madam", "greetings", "hey app"]
    return [(b, "greeting") for b in base]

def gen_greeting_ne():
    base = ["नमस्ते", "नमस्कार", "हेल्लो", "के छ हाल", "शुभ प्रभात", "शुभ साँझ",
            "नमस्ते बहिनी", "नमस्ते दाइ", "हाइ", "हजुर नमस्ते", "के छ त",
            "नमस्कार सर", "बहिनी नमस्ते", "हजुरलाई नमस्कार", "सुप्रभात", "साथी नमस्ते",
            "नमस्ते जी", "आदाब", "हेल्लो हजुर", "नमस्ते बुवा"]
    return [(b, "greeting") for b in base]

def gen_greeting_mixed():
    base = ["hi bhai kasto cha", "namaste, are you there", "hello dai k cha khabar",
            "hi malai chahiyo help", "hey bot k xa halkhabar", "namaste ma euta prashna sodhna chahanchu",
            "hii tapai ko naam k ho", "hello ji sanchai hunuhuncha", "hi are u working offline",
            "namaste bot, are u online", "hey are you the earthquake bot", "hii k help garna saknu hunxa",
            "hello dai malai kehi sodhnu thiyo", "namaste can you help me", "hey bhauju k cha"]
    return [(b, "greeting") for b in base]

# ---- GOODBYE / THANKS ----
def gen_goodbye_en():
    base = ["thank you", "thanks", "thanks a lot", "thank u so much", "ok bye",
            "bye", "thanks for the help", "thank you so much for helping", "gr8 thanks",
            "thnx", "appreciate it", "thank you very much", "ok thanks bye", "cool thanks",
            "thank you, that helped", "bye take care", "ok got it thanks", "thanks bro",
            "much appreciated", "thanks that's all"]
    return [(b, "goodbye_thanks") for b in base]

def gen_goodbye_ne():
    base = ["धन्यवाद", "धेरै धन्यवाद", "धन्यबाद है", "ठिक छ धन्यवाद", "सहयोगको लागि धन्यवाद",
            "धन्यवाद दाई", "धन्यवाद बहिनी", "ल ठिक छ बाई", "बाई", "फेरि भेटौंला",
            "धन्यवाद है साथी", "मद्दतको लागि धन्यवाद", "ठिकै छ छोड्नुहोस्", "धन्यवाद हजुर",
            "यति नै हो धन्यवाद", "ल ठिक छ धन्यवाद", "धन्यवाद बुवा", "ओके धन्यवाद",
            "एकदम धन्यवाद", "बाई है"]
    return [(b, "goodbye_thanks") for b in base]

def gen_goodbye_mixed():
    base = ["thank u dai malai thaha bhayo", "ok thanks bye is ma jaanchu", "thanks a lot bhai",
            "dhanyabad, that helped a lot", "ok bye ta dhanyabad", "thanks yesto helpful huncha",
            "dhanyabad ekdum helpful thiyo", "thank you dai next time feri sodhchu",
            "ok got it dhanyabad bahini", "thanks bro ekdam ramro jankari", "dhanyabad, bye bye",
            "thank u sir ali help bhayo"]
    return [(b, "goodbye_thanks") for b in base]

# ---- SOS HELP REQUEST (generic undirected) ----
def gen_sos_en():
    base = ["help", "help me", "help pls", "need help", "somebody help", "help now",
            "i need help", "please help me", "help help", "sos", "emergency help needed",
            "can anyone help", "help asap", "please someone help", "i need help now",
            "help me pls im scared", "urgent help needed", "help!!", "anyone there help",
            "help me right now", "we need help", "send help", "help required", "hlp me",
            "helpp"]
    return [(b, "sos_help_request") for b in base]

def gen_sos_ne():
    base = ["सहयोग गर्नुहोस्", "मद्दत चाहियो", "सहयोग चाहियो", "कोही छ सहयोग गर्नुहोस्",
            "मद्दत गर्नुहोस् है", "सहयोग", "मलाई मद्दत चाहियो", "बचाउनुहोस्", "म डराएको छु मद्दत गर्नुहोस्",
            "अहिले नै मद्दत चाहियो", "कसैले सहयोग गर्नुहोस्", "मद्दत गर है", "सहयोग गर्नु न",
            "एस ओ एस", "मलाई बचाउनुहोस्", "हामीलाई मद्दत चाहियो", "कोहि छैन र मद्दत गर्ने",
            "मद्दत पठाउनुहोस्", "छिटो मद्दत चाहियो", "सहयोग गर्नु होला"]
    return [(b, "sos_help_request") for b in base]

def gen_sos_mixed():
    base = ["help garnu na plz", "mero lai help chaincha", "sos malai help chai",
            "please help garnu bhai", "help chaincha ma darai xu", "koi cha help garne",
            "mero ghar ma help chai xa", "help pls ma dherai fright ma xu", "sos sos help",
            "immediate help chai xa", "malai bachau please", "help asap malai dherai dar lagyo",
            "koi vane help gara na", "please rescue me malai help chai"]
    return [(b, "sos_help_request") for b in base]

# ---- EARTHQUAKE OCCURRING REPORT ----
def gen_eq_en():
    base = [
        "earthquake", "earthquake now", "there is an earthquake", "earthquake happening right now",
        "big earthquake just hit", "the ground is shaking", "everything is shaking",
        "earthquake in {loc}", "we just felt an earthquake in {loc}", "strong tremor felt {t}",
        "the house is shaking badly", "is this an earthquake", "earthquake just occurred {t}",
        "massive shaking right now", "quake just happened", "earthquake alert",
        "ground shaking very hard", "tremors felt across {loc}", "earthquake hit {loc} {t}",
        "everything is falling because of the earthquake",
    ]
    out = []
    for b in base:
        if "{loc}" in b or "{t}" in b:
            for loc in LOCATIONS_EN[:6]:
                for t in TIME_EN[:2]:
                    out.append((b.format(loc=loc, t=t), "earthquake_occurring_report"))
        else:
            out.append((b, "earthquake_occurring_report"))
    return out

def gen_eq_ne():
    base = [
        "भूकम्प गयो", "भूकम्प आयो", "अहिले भूकम्प गयो", "जोडदार भूकम्प आयो",
        "भूइँ हल्लियो", "घर हल्लियो", "यो भूकम्प हो कि", "{loc} मा भूकम्प गयो",
        "{t} भूकम्प आयो", "एकदमै जोडले हल्लियो", "भूकम्पको धक्का महसुस भयो",
        "घर धेरै हल्लियो", "भूकम्पले सबै हल्लियो", "{loc} मा जोडदार धक्का महसुस भयो",
        "भूकम्प {t} आएको हो",
    ]
    out = []
    for b in base:
        if "{loc}" in b or "{t}" in b:
            for loc in LOCATIONS_NE[:6]:
                for t in TIME_NE[:2]:
                    out.append((b.format(loc=loc, t=t), "earthquake_occurring_report"))
        else:
            out.append((b, "earthquake_occurring_report"))
    return out

def gen_eq_mixed():
    base = [
        "bhukampa aayo", "bhukampa aayo abhi", "ghar hallyo bhukampa jasto",
        "earthquake bhayo hamro area ma", "bhukampa gayo {loc} ma", "jhatka mahsus bhayo {t}",
        "big bhukampa jasto lagyo", "ghar ekdam hallyo earthquake ho ki k ho",
        "bhukampa ko jhatka {t} feel bhayo", "strong tremor bhukampa jasto",
        "sabai hallyo bhukampa le", "bhukampa report garna man xa {loc} ma",
    ]
    out = []
    for b in base:
        if "{loc}" in b or "{t}" in b:
            for loc in ["Kathmandu", "Pokhara", "Gorkha", "hamro area", "mero ghar najik"]:
                for t in ["abhi", "5 minute agadi", "aaile"]:
                    out.append((b.format(loc=loc, t=t), "earthquake_occurring_report"))
        else:
            out.append((b, "earthquake_occurring_report"))
    return out

# ---- TRAPPED / DEBRIS ----
def gen_trapped_en():
    base = [
        "i am trapped under debris", "trapped under rubble", "stuck under a collapsed wall",
        "{fam} is trapped under debris", "we are trapped inside the building",
        "can't move, trapped under concrete", "stuck can't get out", "buried under rubble",
        "trapped in the collapsed house", "i am stuck cannot breathe well",
        "{fam} is stuck under the roof", "trapped need rescue team", "pinned under debris",
        "we are stuck inside, walls collapsed", "trapped, please send rescue",
    ]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_EN[:8]:
                out.append((b.format(fam=f), "trapped_debris_report"))
        else:
            out.append((b, "trapped_debris_report"))
    return out

def gen_trapped_ne():
    base = [
        "म पर्खालमुनि थुनिएँ", "पर्खाल भत्किएर पुरियो", "{fam} भग्नावशेषमुनि थुनिनुभयो",
        "घर भत्किएर भित्र फसियौं", "हल्लन सक्दिन थुनिएको छु", "छत खसेर {fam} थुनिनुभयो",
        "मलाई निकाल्नुहोस् थुनिएको छु", "भत्किएको घरभित्र फसेको छु", "उद्धार टोली चाहियो थुनिएको छु",
        "पर्खालले थिचेको छ हल्लन सक्दिन", "म र {fam} थुनिएका छौं", "छिटो निकाल्नुहोस् थुनिएको छु",
    ]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_NE[:8]:
                out.append((b.format(fam=f), "trapped_debris_report"))
        else:
            out.append((b, "trapped_debris_report"))
    return out

def gen_trapped_mixed():
    base = [
        "malai pillar le thichyo cannot move", "{fam} debris muni thuniyo",
        "trapped xu ghar bhatkeko debris muni", "rescue chai xa ma thuniyeko xu",
        "wall khaseko le {fam} lai thichyo", "cannot move stuck under concrete malai",
        "ghar collapse bhayo hami bhitra fasyou", "malai nikalnu hos thuniyeko xu",
        "{fam} pinned under debris malai help chai",
    ]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in ["mero didi", "mero bhai", "mero buwa", "mero aama", "mero saathi"]:
                out.append((b.format(fam=f), "trapped_debris_report"))
        else:
            out.append((b, "trapped_debris_report"))
    return out

# ---- MEDICAL EMERGENCY ----
def gen_medical_en():
    base = [
        "need an ambulance", "{fam} needs ambulance urgently", "medical emergency please help",
        "heart attack symptoms need doctor", "{fam} is unconscious", "someone is not breathing",
        "need doctor immediately", "{fam} collapsed and not waking up", "severe bleeding need medic",
        "pregnant woman needs emergency care", "need ambulance at {loc}", "{fam} having chest pain",
        "medical help needed urgently", "someone fainted need medical help",
        "critical patient needs ambulance now",
    ]
    out = []
    for b in base:
        if "{fam}" in b and "{loc}" in b:
            out.append((b, "medical_emergency_request"))
        elif "{fam}" in b:
            for f in FAMILY_EN[:6]:
                out.append((b.format(fam=f), "medical_emergency_request"))
        elif "{loc}" in b:
            for loc in LOCATIONS_EN[:5]:
                out.append((b.format(loc=loc), "medical_emergency_request"))
        else:
            out.append((b, "medical_emergency_request"))
    return out

def gen_medical_ne():
    base = [
        "एम्बुलेन्स चाहियो", "{fam} लाई एम्बुलेन्स चाहियो छिटो", "मेडिकल इमर्जेन्सी छ मद्दत गर्नुहोस्",
        "{fam} बेहोस हुनुभयो", "कोही सास फेर्न सकिरहेको छैन", "डाक्टर तुरुन्तै चाहियो",
        "धेरै रगत बगिरहेको छ मेडिक चाहियो", "गर्भवती महिलालाई उपचार चाहियो",
        "{loc} मा एम्बुलेन्स चाहियो", "{fam} लाई छातीमा दुखाइ भइरहेको छ",
        "गम्भीर बिरामीलाई एम्बुलेन्स चाहियो अहिले",
    ]
    out = []
    for b in base:
        if "{fam}" in b and "{loc}" in b:
            out.append((b, "medical_emergency_request"))
        elif "{fam}" in b:
            for f in FAMILY_NE[:6]:
                out.append((b.format(fam=f), "medical_emergency_request"))
        elif "{loc}" in b:
            for loc in LOCATIONS_NE[:5]:
                out.append((b.format(loc=loc), "medical_emergency_request"))
        else:
            out.append((b, "medical_emergency_request"))
    return out

def gen_medical_mixed():
    base = [
        "ambulance chaincha malai", "{fam} lai ambulance chai urgent",
        "medical emergency cha help garnu", "{fam} unconscious bhayo",
        "sas pherna sakeko xaina koi", "doctor chai xa abhi nai",
        "dherai raagat bagira xa medic chai xa", "pregnant lady lai emergency care chai",
        "{loc} ma ambulance patau na", "{fam} lai chest ma dukheko xa",
    ]
    out = []
    for b in base:
        if "{fam}" in b and "{loc}" in b:
            out.append((b, "medical_emergency_request"))
        elif "{fam}" in b:
            for f in ["mero buwa", "mero aama", "mero bhai", "mero saathi"]:
                out.append((b.format(fam=f), "medical_emergency_request"))
        elif "{loc}" in b:
            for loc in ["Kathmandu", "mero ghar", "hostel", "school area"]:
                out.append((b.format(loc=loc), "medical_emergency_request"))
        else:
            out.append((b, "medical_emergency_request"))
    return out

# ---- INJURY REPORT ----
def gen_injury_en():
    base = ["i am injured", "{fam} is injured badly", "cut on my leg bleeding",
            "broken arm need help", "head injury from falling debris", "hurt my leg during earthquake",
            "{fam} has a deep wound", "bleeding from head", "sprained ankle can't walk",
            "got hit by falling bricks", "minor injury on hand", "{fam} fell and hurt back",
            "burned my hand slightly", "twisted leg while running out"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_EN[:6]:
                out.append((b.format(fam=f), "injury_report"))
        else:
            out.append((b, "injury_report"))
    return out

def gen_injury_ne():
    base = ["मलाई चोट लागेको छ", "{fam} लाई गम्भीर चोट लागेको छ", "खुट्टामा घाउ भएर रगत बगिरहेको छ",
            "हात भाँचिएको छ मद्दत चाहियो", "भग्नावशेष खसेर टाउकोमा चोट लाग्यो",
            "भूकम्पको बेला खुट्टामा चोट लाग्यो", "{fam} लाई गहिरो घाउ छ", "टाउकोबाट रगत बगिरहेको छ",
            "गोडा मर्केर हिँड्न सकिँन", "इँटा खसेर लाग्यो", "हातमा सामान्य चोट लागेको छ",
            "{fam} लडेरढाडमा चोट लाग्यो"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_NE[:6]:
                out.append((b.format(fam=f), "injury_report"))
        else:
            out.append((b, "injury_report"))
    return out

def gen_injury_mixed():
    base = ["mero khutta ma chot lagyo", "{fam} lai badly injury bhayo", "haat bhachiyo help chai",
            "head injury bhayo debris khaseko le", "khutta ma chot lagyo running bela",
            "{fam} lai deep wound xa", "taauko bata raagat bagira xa", "ankle sprain bhayo hidna sakina",
            "brick khaseko le lagyo", "haat ma minor chot xa"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in ["mero didi", "mero bhai", "mero saathi", "mero buwa"]:
                out.append((b.format(fam=f), "injury_report"))
        else:
            out.append((b, "injury_report"))
    return out

# ---- FIRE INCIDENT ----
def gen_fire_en():
    base = ["fire broke out after the earthquake", "there is a fire in {loc}",
            "kitchen caught fire during quake", "building on fire near {loc}",
            "smoke coming from the house", "electrical fire started", "fire spreading fast in {loc}",
            "gas stove caused fire", "house is burning need fire brigade", "small fire in the kitchen",
            "fire alert near market"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:6]:
                out.append((b.format(loc=loc), "fire_incident_report"))
        else:
            out.append((b, "fire_incident_report"))
    return out

def gen_fire_ne():
    base = ["भूकम्पपछि आगलागी भयो", "{loc} मा आगो लागेको छ", "भूकम्पको बेला भान्सामा आगो लाग्यो",
            "{loc} नजिकैको घरमा आगो लागेको छ", "घरबाट धुवाँ आइरहेको छ", "बिजुलीको तारबाट आगो लाग्यो",
            "{loc} मा आगो छिट्टै फैलिँदैछ", "ग्यास चुल्होले आगो लाग्यो", "घर बलिरहेको छ दमकल चाहियो",
            "भान्सामा सानो आगो लागेको छ"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:6]:
                out.append((b.format(loc=loc), "fire_incident_report"))
        else:
            out.append((b, "fire_incident_report"))
    return out

def gen_fire_mixed():
    base = ["aago lagyo bhukampa pachi", "{loc} ma fire lagyo", "kitchen ma aago lagyo bhukampa ko bela",
            "building ma fire xa {loc} najik", "ghar bata dhuwa airaxa", "electrical fire lagyo",
            "aago chittai failira xa {loc} ma", "gas stove le aago lagyo", "ghar baliraxa fire brigade chai"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["Kathmandu", "hamro area", "bazaar", "school najik"]:
                out.append((b.format(loc=loc), "fire_incident_report"))
        else:
            out.append((b, "fire_incident_report"))
    return out

# ---- GAS LEAK ----
def gen_gas_en():
    base = ["gas leak bhayo", "gas leak in the house", "smell of gas after earthquake",
            "cylinder leaking gas", "gas leak near {loc}", "kitchen gas leaking badly",
            "strong gas smell in the building", "gas pipe broke during quake",
            "gas leak, please advise", "worried about gas leak in apartment"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:5]:
                out.append((b.format(loc=loc), "gas_leak_report"))
        else:
            out.append((b, "gas_leak_report"))
    return out

def gen_gas_ne():
    base = ["ग्यास चुहियो", "घरमा ग्यास चुहावट भयो", "भूकम्पपछि ग्यासको गन्ध आइरहेको छ",
            "सिलिन्डरबाट ग्यास चुहिँदैछ", "{loc} नजिक ग्यास चुहावट भयो", "भान्सामा ग्यास धेरै चुहिँदैछ",
            "घरभरि ग्यासको गन्ध छ", "ग्यासको पाइप भाँचियो भूकम्पमा", "ग्यास चुहावट भयो सल्लाह दिनुहोस्"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:5]:
                out.append((b.format(loc=loc), "gas_leak_report"))
        else:
            out.append((b, "gas_leak_report"))
    return out

def gen_gas_mixed():
    base = ["gas leak bhayo ghar ma", "gas ko smell airaxa bhukampa pachi", "cylinder bata gas chuhi raxa",
            "{loc} najik gas leak bhayo", "kitchen ma gas dherai chuhira xa", "strong gas smell xa building ma"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["hamro ghar", "hostel", "Kathmandu"]:
                out.append((b.format(loc=loc), "gas_leak_report"))
        else:
            out.append((b, "gas_leak_report"))
    return out

# ---- BUILDING COLLAPSE ----
def gen_collapse_en():
    base = ["building collapsed in {loc}", "the house has completely collapsed",
            "roof caved in during the quake", "wall collapsed on the street",
            "entire building came down in {loc}", "school building partially collapsed",
            "our house collapsed completely", "apartment block collapsed nearby",
            "structure collapsed, people may be inside"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:6]:
                out.append((b.format(loc=loc), "building_collapse_report"))
        else:
            out.append((b, "building_collapse_report"))
    return out

def gen_collapse_ne():
    base = ["{loc} मा घर भत्कियो", "घर पूर्ण रूपमा भत्कियो", "भूकम्पमा छत खस्यो",
            "सडकमा पर्खाल भत्कियो", "{loc} मा सम्पूर्ण भवन ढल्यो", "स्कूल भवन आंशिक रूपमा भत्कियो",
            "हाम्रो घर पूर्ण रूपमा भत्कियो", "नजिकैको अपार्टमेन्ट भत्कियो",
            "संरचना भत्कियो मानिसहरू भित्रै हुन सक्छन्"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:6]:
                out.append((b.format(loc=loc), "building_collapse_report"))
        else:
            out.append((b, "building_collapse_report"))
    return out

def gen_collapse_mixed():
    base = ["ghar bhatkiyo {loc} ma", "ghar pura bhatkiyo", "chat khasyo bhukampa ma",
            "wall bhatkiyo road ma", "pura building dhalyo {loc} ma", "school building half bhatkiyo",
            "hamro ghar pura bhatkiyo", "najikai ko apartment bhatkiyo"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["Kathmandu", "hamro area", "gaun"]:
                out.append((b.format(loc=loc), "building_collapse_report"))
        else:
            out.append((b, "building_collapse_report"))
    return out

# ---- BUILDING DAMAGE CHECK ----
def gen_damage_check_en():
    base = ["my house has cracks is it safe", "should i re-enter the building",
            "there are cracks in the wall", "is it safe to stay in this house",
            "how do i know if my building is safe", "cracks appeared after the quake",
            "building tilted slightly is it dangerous", "can i go back inside my house now",
            "wall has big cracks should i evacuate", "who inspects building safety after earthquake",
            "is my apartment structurally safe now"]
    return [(b, "building_damage_check") for b in base]

def gen_damage_check_ne():
    base = ["मेरो घरमा चिरा परेको छ सुरक्षित छ कि छैन", "के म भवनभित्र फेरि जान मिल्छ",
            "पर्खालमा चिरा देखिएको छ", "यो घरमा बस्न सुरक्षित छ कि छैन",
            "मेरो भवन सुरक्षित छ कि भनेर कसरी थाहा पाउने", "भूकम्पपछि चिरा देखा पर्यो",
            "भवन अलिकति ढल्किएको छ खतरा छ कि", "के म अहिले घरभित्र फर्कन सक्छु",
            "पर्खालमा ठूला चिरा छन् बाहिरिनु पर्छ कि", "भूकम्पपछि भवनको सुरक्षा जाँच कसले गर्छ"]
    return [(b, "building_damage_check") for b in base]

def gen_damage_check_mixed():
    base = ["mero ghar ma crack aayo safe cha ki", "ghar bhitra farkana milxa ki",
            "wall ma crack dekhiyo", "yo ghar ma basna safe cha ki xaina",
            "building safe cha ki kasari thaha pauney", "bhukampa pachi crack aayo",
            "building aliakti tilt bhayo danger cha ki", "abhi ghar bhitra jana milxa ki",
            "wall ma thulo crack cha evacuate garne ki"]
    return [(b, "building_damage_check") for b in base]

# ---- SAFE LOCATION QUERY ----
def gen_safeloc_en():
    base = ["safe place near me", "where is the nearest safe zone", "safe place kaha xa near {loc}",
            "where should i go for safety", "nearest open ground for evacuation",
            "where is the designated safe zone in {loc}", "safe evacuation point near me",
            "which open area is safe to gather", "where can we take shelter safely",
            "nearest safe assembly point"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:6]:
                out.append((b.format(loc=loc), "safe_location_query"))
        else:
            out.append((b, "safe_location_query"))
    return out

def gen_safeloc_ne():
    base = ["नजिकैको सुरक्षित ठाउँ कहाँ छ", "सबैभन्दा नजिकको सुरक्षित क्षेत्र कहाँ छ",
            "म सुरक्षाको लागि कहाँ जानुपर्छ", "उद्धारका लागि नजिकैको खुल्ला ठाउँ",
            "{loc} मा तोकिएको सुरक्षित क्षेत्र कहाँ छ", "नजिकैको सुरक्षित भेला हुने ठाउँ",
            "कुन खुल्ला ठाउँ भेला हुन सुरक्षित छ", "हामी कहाँ सुरक्षित आश्रय लिन सक्छौं"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:6]:
                out.append((b.format(loc=loc), "safe_location_query"))
        else:
            out.append((b, "safe_location_query"))
    return out

def gen_safeloc_mixed():
    base = ["safe place kaha cha", "najikai ko safe zone kaha cha", "malai kaha jana safe huncha",
            "evacuation ko lagi khulla thau kaha cha", "{loc} ma safe zone kaha cha",
            "najik ko assembly point kaha cha", "kun khulla thau safe cha gather garna",
            "hami kaha shelter linna sakxam safely"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["Kathmandu", "hamro area", "yaha"]:
                out.append((b.format(loc=loc), "safe_location_query"))
        else:
            out.append((b, "safe_location_query"))
    return out

# ---- SHELTER REQUEST ----
def gen_shelter_en():
    base = ["need shelter for my family", "where can we get temporary shelter",
            "tent camp location needed", "displaced need a place to stay",
            "our house is unsafe need shelter", "shelter needed for {fam} and kids",
            "any relief camp nearby", "need tents for the night", "where is the nearest relief camp",
            "no house to stay need shelter urgently"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_EN[:4]:
                out.append((b.format(fam=f), "shelter_request"))
        else:
            out.append((b, "shelter_request"))
    return out

def gen_shelter_ne():
    base = ["मेरो परिवारको लागि आश्रय चाहियो", "हामीले अस्थायी आश्रय कहाँ पाउन सक्छौं",
            "पाल शिविरको स्थान चाहियो", "विस्थापितहरूलाई बस्ने ठाउँ चाहिन्छ",
            "हाम्रो घर असुरक्षित छ आश्रय चाहियो", "{fam} र बालबालिकाका लागि आश्रय चाहियो",
            "नजिकै कुनै राहत शिविर छ कि", "राति बस्न पाल चाहियो", "नजिकैको राहत शिविर कहाँ छ"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_NE[:4]:
                out.append((b.format(fam=f), "shelter_request"))
        else:
            out.append((b, "shelter_request"))
    return out

def gen_shelter_mixed():
    base = ["shelter chaincha mero family ko lagi", "temporary shelter kaha paunxa",
            "tent camp ko location chai", "hamro ghar unsafe xa shelter chai",
            "{fam} ra kids ko lagi shelter chai", "relief camp najik cha ki",
            "raati basna tent chai", "najik ko relief camp kaha cha"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in ["mero family", "mero aama buwa", "mero saathi haru"]:
                out.append((b.format(fam=f), "shelter_request"))
        else:
            out.append((b, "shelter_request"))
    return out

# ---- EVACUATION GUIDANCE ----
def gen_evac_en():
    base = ["how do i evacuate safely", "what is the evacuation route", "should we evacuate now",
            "steps to evacuate the building", "evacuation plan for {loc}", "do we need to evacuate immediately",
            "safest way to leave the building", "evacuation instructions please",
            "how to evacuate with elderly people", "what to do during evacuation"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:5]:
                out.append((b.format(loc=loc), "evacuation_guidance_query"))
        else:
            out.append((b, "evacuation_guidance_query"))
    return out

def gen_evac_ne():
    base = ["सुरक्षित रूपमा कसरी निकासा गर्ने", "निकासाको मार्ग के हो", "के हामी अहिले नै निकासा गर्नुपर्छ",
            "भवनबाट निकासा गर्ने चरणहरू", "{loc} को लागि निकासा योजना", "के हामी तुरुन्तै निकासा गर्नुपर्छ",
            "भवनबाट बाहिर निस्कने सबैभन्दा सुरक्षित तरिका", "निकासाका निर्देशनहरू दिनुहोस्",
            "वृद्धवृद्धाहरूसँग कसरी निकासा गर्ने"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:5]:
                out.append((b.format(loc=loc), "evacuation_guidance_query"))
        else:
            out.append((b, "evacuation_guidance_query"))
    return out

def gen_evac_mixed():
    base = ["kasari safely evacuate garne", "evacuation ko route k ho", "hami abhi evacuate garnu parxa ki",
            "building bata evacuate garne steps", "{loc} ko lagi evacuation plan",
            "building bata bahira niskane safest tarika", "evacuation ko instructions dinu hos",
            "budo budi sanga kasari evacuate garne"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["Kathmandu", "hamro area"]:
                out.append((b.format(loc=loc), "evacuation_guidance_query"))
        else:
            out.append((b, "evacuation_guidance_query"))
    return out

# ---- FAMILY MEMBER MISSING ----
def gen_missing_en():
    base = ["{fam} is missing since the earthquake", "cannot find {fam} after the quake",
            "lost contact with {fam}", "{fam} did not come home yet", "missing person report for {fam}",
            "searching for {fam} in {loc}", "{fam} phone not reachable since quake",
            "have not heard from {fam} since morning"]
    out = []
    for b in base:
        if "{fam}" in b and "{loc}" in b:
            for f in FAMILY_EN[:6]:
                for loc in LOCATIONS_EN[:3]:
                    out.append((b.format(fam=f, loc=loc), "family_member_missing"))
        elif "{fam}" in b:
            for f in FAMILY_EN[:8]:
                out.append((b.format(fam=f), "family_member_missing"))
        else:
            out.append((b, "family_member_missing"))
    return out

def gen_missing_ne():
    base = ["भूकम्पदेखि {fam} बेपत्ता हुनुभएको छ", "भूकम्पपछि {fam} लाई भेट्टाउन सकिएको छैन",
            "{fam} सँग सम्पर्क टुटेको छ", "{fam} अझै घर आउनुभएको छैन",
            "{fam} को बेपत्ता व्यक्ति रिपोर्ट", "{loc} मा {fam} लाई खोजिरहेको छु",
            "भूकम्पदेखि {fam} को फोन लाग्दैन", "बिहानदेखि {fam} बाट कुनै खबर छैन"]
    out = []
    for b in base:
        if "{fam}" in b and "{loc}" in b:
            for f in FAMILY_NE[:6]:
                for loc in LOCATIONS_NE[:3]:
                    out.append((b.format(fam=f, loc=loc), "family_member_missing"))
        elif "{fam}" in b:
            for f in FAMILY_NE[:8]:
                out.append((b.format(fam=f), "family_member_missing"))
        else:
            out.append((b, "family_member_missing"))
    return out

def gen_missing_mixed():
    base = ["{fam} bhukampa pachi missing hunuhuncha", "bhukampa pachi {fam} lai bhettauna sakina",
            "{fam} sanga contact tutyo", "{fam} ghar aaunu bhako xaina ahile samma",
            "{fam} ko phone lagdaina bhukampa dekhi", "bihana dekhi {fam} bata khabar xaina"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in ["mero didi", "mero bhai", "mero buwa", "mero aama", "mero saathi", "mero mama"]:
                out.append((b.format(fam=f), "family_member_missing"))
        else:
            out.append((b, "family_member_missing"))
    return out

# ---- FAMILY REUNIFICATION STATUS ----
def gen_reunify_en():
    base = ["found my family member safe", "{fam} has been located safely", "reunited with {fam} now",
            "how to register a found family member", "how does family reunification work",
            "found {fam} at the relief camp", "want to update status that {fam} is safe",
            "process to report a family member found"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_EN[:6]:
                out.append((b.format(fam=f), "family_reunification_status"))
        else:
            out.append((b, "family_reunification_status"))
    return out

def gen_reunify_ne():
    base = ["मेरो परिवारको सदस्य सुरक्षित भेटियो", "{fam} लाई सुरक्षित फेला परेको छ",
            "अहिले {fam} सँग भेट भयो", "भेटिएको परिवार सदस्य कसरी दर्ता गर्ने",
            "परिवार पुनर्मिलन प्रक्रिया के हो", "राहत शिविरमा {fam} भेटियो",
            "{fam} सुरक्षित हुनुहुन्छ भनेर स्थिति अपडेट गर्न चाहन्छु"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_NE[:6]:
                out.append((b.format(fam=f), "family_reunification_status"))
        else:
            out.append((b, "family_reunification_status"))
    return out

def gen_reunify_mixed():
    base = ["mero family member safe bhetiyo", "{fam} lai safely locate garya",
            "{fam} sanga abhi reunite bhayo", "bhetieko family member lai kasari register garne",
            "relief camp ma {fam} bhetiyo", "{fam} safe cha vanera status update garna man xa"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in ["mero didi", "mero bhai", "mero buwa", "mero aama"]:
                out.append((b.format(fam=f), "family_reunification_status"))
        else:
            out.append((b, "family_reunification_status"))
    return out

# ---- FOOD WATER REQUEST ----
def gen_foodwater_en():
    base = ["need drinking water", "no food since yesterday", "need food supplies for family",
            "water supply cut off need water", "need clean drinking water urgently",
            "ran out of food and water", "need baby formula and water", "food distribution point nearby",
            "no clean water available here", "need ration for {fam}"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_EN[:4]:
                out.append((b.format(fam=f), "food_water_request"))
        else:
            out.append((b, "food_water_request"))
    return out

def gen_foodwater_ne():
    base = ["खानेपानी चाहियो", "हिजोदेखि खाना छैन", "परिवारको लागि खाद्य सामग्री चाहियो",
            "पानीको आपूर्ति बन्द भयो पानी चाहियो", "सफा खानेपानी तुरुन्तै चाहियो",
            "खाना र पानी सकियो", "बच्चाको लागि फर्मुला र पानी चाहियो", "नजिकैको खाद्य वितरण स्थल",
            "यहाँ सफा पानी उपलब्ध छैन", "{fam} को लागि खाद्यान्न चाहियो"]
    out = []
    for b in base:
        if "{fam}" in b:
            for f in FAMILY_NE[:4]:
                out.append((b.format(fam=f), "food_water_request"))
        else:
            out.append((b, "food_water_request"))
    return out

def gen_foodwater_mixed():
    base = ["khane pani chaincha", "hijo dekhi khana xaina", "family ko lagi food supply chai",
            "pani ko supply band bhayo pani chai", "saaf khane pani urgent chai",
            "khana ra pani sakiyo", "baby formula ra pani chai", "food distribution point najik cha ki",
            "yaha saaf pani xaina"]
    return [(b, "food_water_request") for b in base]

# ---- FIRST AID QUERY ----
def gen_firstaid_en():
    base = ["how to stop bleeding", "first aid for a broken arm", "how to treat a cut wound",
            "cpr steps please", "how to help someone who fainted", "first aid for burns",
            "how to bandage a wound properly", "what to do for a sprained ankle",
            "first aid kit items needed", "how to help choking person"]
    return [(b, "first_aid_query") for b in base]

def gen_firstaid_ne():
    base = ["रगत बग्न रोक्ने उपाय के हो", "भाँचिएको हातको लागि प्राथमिक उपचार",
            "घाउ भएको ठाउँमा कसरी उपचार गर्ने", "सी पी आर कसरी गर्ने",
            "बेहोस भएको मान्छेलाई कसरी मद्दत गर्ने", "पोलेको ठाउँको लागि प्राथमिक उपचार",
            "घाउमा पट्टी कसरी बाँध्ने", "मर्केको खुट्टाको लागि के गर्ने",
            "प्राथमिक उपचार किटमा के चाहिन्छ"]
    return [(b, "first_aid_query") for b in base]

def gen_firstaid_mixed():
    base = ["raagat bagna roknu ko upaya k ho", "bhachiyeko haat ko first aid k ho",
            "ghau bhayeko thau ma kasari treat garne", "cpr kasari garne",
            "behosh bhako manxe lai kasari help garne", "poleko thau ko first aid",
            "ghau ma bandage kasari garne", "sprain bhayeko khutta ko lagi k garne"]
    return [(b, "first_aid_query") for b in base]

# ---- AFTERSHOCK INFO ----
def gen_aftershock_en():
    base = ["will there be aftershocks", "how long do aftershocks continue", "is another earthquake coming",
            "should i expect more tremors tonight", "aftershock warning for {loc}",
            "how strong will aftershocks be", "is it safe to sleep indoors after aftershocks",
            "how many aftershocks are expected", "aftershock update please"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:5]:
                out.append((b.format(loc=loc), "aftershock_information_query"))
        else:
            out.append((b, "aftershock_information_query"))
    return out

def gen_aftershock_ne():
    base = ["के पराकम्प आउने छ", "पराकम्प कति समयसम्म रहन्छ", "अर्को भूकम्प आउने छ कि",
            "आज राति थप धक्का आउन सक्छ कि", "{loc} को लागि पराकम्प चेतावनी",
            "पराकम्प कति शक्तिशाली हुन्छ", "पराकम्पपछि घरभित्र सुत्न सुरक्षित छ कि",
            "कति पराकम्प आउने अपेक्षा छ", "पराकम्पको जानकारी दिनुहोस्"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:5]:
                out.append((b.format(loc=loc), "aftershock_information_query"))
        else:
            out.append((b, "aftershock_information_query"))
    return out

def gen_aftershock_mixed():
    base = ["aftershock aaunxa ki", "aftershock kati samma rahanxa", "arko bhukampa aaunxa ki",
            "aaja raati arko jhatka aaunxa ki", "{loc} ko lagi aftershock warning",
            "aftershock kati strong huncha", "aftershock pachi ghar bhitra sutna safe cha ki"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["Kathmandu", "hamro area"]:
                out.append((b.format(loc=loc), "aftershock_information_query"))
        else:
            out.append((b, "aftershock_information_query"))
    return out

# ---- EMERGENCY CONTACT REQUEST ----
def gen_contact_en():
    base = ["what is the ambulance number", "police emergency number please", "fire brigade contact number",
            "nepal red cross helpline number", "emergency contact numbers list",
            "who do i call for rescue", "national emergency operation center number",
            "tourist police number please", "child helpline number", "disaster reporting hotline"]
    return [(b, "emergency_contact_request") for b in base]

def gen_contact_ne():
    base = ["एम्बुलेन्सको नम्बर के हो", "प्रहरी आपतकालीन नम्बर दिनुहोस्", "दमकलको सम्पर्क नम्बर",
            "नेपाल रेडक्रसको हेल्पलाइन नम्बर", "आपतकालीन सम्पर्क नम्बरहरूको सूची",
            "उद्धारका लागि कहाँ फोन गर्ने", "राष्ट्रिय आपतकालीन कार्य केन्द्रको नम्बर",
            "पर्यटक प्रहरीको नम्बर दिनुहोस्", "बाल हेल्पलाइन नम्बर", "विपद रिपोर्टिङ हटलाइन"]
    return [(b, "emergency_contact_request") for b in base]

def gen_contact_mixed():
    base = ["ambulance ko number k ho", "police emergency number dinu hos", "fire brigade ko contact number",
            "red cross ko helpline number", "emergency contact number haru ko list",
            "rescue ko lagi kaha phone garne", "tourist police ko number dinu hos"]
    return [(b, "emergency_contact_request") for b in base]

# ---- POWER OUTAGE REPORT ----
def gen_power_en():
    base = ["power outage in {loc}", "no electricity since the earthquake", "electricity cut off in our area",
            "power lines down in {loc}", "when will power be restored", "no power for two days now",
            "electricity is out across the neighborhood"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:6]:
                out.append((b.format(loc=loc), "power_outage_report"))
        else:
            out.append((b, "power_outage_report"))
    return out

def gen_power_ne():
    base = ["{loc} मा बिजुली गएको छ", "भूकम्पदेखि बिजुली छैन", "हाम्रो क्षेत्रमा बिजुली कटौती भयो",
            "{loc} मा बिजुलीको तार खसेको छ", "बिजुली कहिले आउँछ", "दुई दिनदेखि बिजुली छैन",
            "छिमेकभरि बिजुली गएको छ"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:6]:
                out.append((b.format(loc=loc), "power_outage_report"))
        else:
            out.append((b, "power_outage_report"))
    return out

def gen_power_mixed():
    base = ["power outage cha {loc} ma", "bhukampa dekhi bijuli xaina", "hamro area ma bijuli katti bhayo",
            "{loc} ma power line khaseko cha", "bijuli kahile aaunxa", "2 din dekhi bijuli xaina"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["Kathmandu", "hamro area"]:
                out.append((b.format(loc=loc), "power_outage_report"))
        else:
            out.append((b, "power_outage_report"))
    return out

# ---- ROAD BLOCKAGE ----
def gen_road_en():
    base = ["road blocked by landslide near {loc}", "the main road is blocked", "bridge collapsed near {loc}",
            "road cracked cannot pass", "highway blocked due to debris", "cannot reach {loc} road is closed",
            "landslide blocking the only road out", "road damaged after earthquake"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_EN[:6]:
                out.append((b.format(loc=loc), "road_blockage_report"))
        else:
            out.append((b, "road_blockage_report"))
    return out

def gen_road_ne():
    base = ["{loc} नजिक पहिरोले सडक बन्द भयो", "मुख्य सडक बन्द छ", "{loc} नजिकको पुल भत्कियो",
            "सडक चिरा परेर जान सकिँदैन", "मलबाका कारण राजमार्ग बन्द भयो", "{loc} जान सकिँदैन सडक बन्द छ",
            "पहिरोले एकमात्र सडक बन्द भयो", "भूकम्पपछि सडक क्षतिग्रस्त भयो"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in LOCATIONS_NE[:6]:
                out.append((b.format(loc=loc), "road_blockage_report"))
        else:
            out.append((b, "road_blockage_report"))
    return out

def gen_road_mixed():
    base = ["road block bhayo landslide le {loc} najik", "main road band cha", "{loc} najik ko pul bhatkiyo",
            "road ma crack bhayo jana sakidaina", "debris le highway band bhayo", "{loc} jana sakidaina road band cha"]
    out = []
    for b in base:
        if "{loc}" in b:
            for loc in ["Kathmandu", "gaun", "hamro area"]:
                out.append((b.format(loc=loc), "road_blockage_report"))
        else:
            out.append((b, "road_blockage_report"))
    return out

# ---- PREPAREDNESS TIPS ----
def gen_prep_en():
    base = ["how to prepare an earthquake go bag", "how to make my house earthquake safe",
            "what should be in an emergency kit", "how to secure furniture from falling",
            "earthquake preparedness tips please", "how to prepare kids for earthquake drills",
            "what to keep ready before an earthquake", "how often should i check emergency supplies",
            "best practices for earthquake preparedness at home", "how to plan a family emergency meeting point"]
    return [(b, "preparedness_tips_query") for b in base]

def gen_prep_ne():
    base = ["भूकम्पको लागि गो-ब्याग कसरी तयार पार्ने", "मेरो घरलाई भूकम्प प्रतिरोधी कसरी बनाउने",
            "आपतकालीन किटमा के के हुनुपर्छ", "फर्निचरलाई खस्नबाट कसरी सुरक्षित गर्ने",
            "भूकम्प तयारीका सुझावहरू दिनुहोस्", "बालबालिकालाई भूकम्प अभ्यासको लागि कसरी तयार पार्ने",
            "भूकम्प अघि के के तयार राख्ने", "आपतकालीन सामान कति पटक जाँच्ने",
            "घरमा भूकम्प तयारीको उत्तम अभ्यास के हो", "परिवारको भेला हुने ठाउँ कसरी योजना बनाउने"]
    return [(b, "preparedness_tips_query") for b in base]

def gen_prep_mixed():
    base = ["earthquake go bag kasari prepare garne", "mero ghar lai earthquake safe kasari banaune",
            "emergency kit ma k k hunu parxa", "furniture lai khasnu bata kasari secure garne",
            "earthquake preparedness ko tips dinu hos", "bachcha haru lai earthquake drill ko lagi kasari prepare garne",
            "earthquake agadi k k ready rakhne", "emergency supplies kati choti check garne"]
    return [(b, "preparedness_tips_query") for b in base]

# ---- STATUS CHECK GENERAL ----
def gen_status_en():
    base = ["what should i do now", "what to do after an earthquake", "what should i do right now",
            "give me next steps please", "what is the current situation", "what actions should i take now",
            "i dont know what to do", "guide me on what to do", "what steps should i follow now",
            "tell me what to do immediately"]
    return [(b, "status_check_general") for b in base]

def gen_status_ne():
    base = ["अहिले मैले के गर्नुपर्छ", "भूकम्पपछि के गर्ने", "अहिले मैले के गर्ने",
            "अर्को चरणहरू भन्नुहोस्", "अहिलेको अवस्था के हो", "अहिले मैले के कदम चाल्ने",
            "मलाई थाहा छैन के गर्ने", "के गर्ने भनेर मलाई मार्गदर्शन गर्नुहोस्",
            "अहिले कुन चरण पालना गर्ने", "मलाई तुरुन्तै के गर्ने भनेर भन्नुहोस्"]
    return [(b, "status_check_general") for b in base]

def gen_status_mixed():
    base = ["ahile k garne ma", "bhukampa pachi k garne", "ahile k garnu parxa",
            "next steps k ho bhannu hos", "ahile ko situation k ho", "ahile k action linu parxa",
            "malai thaha xaina k garne", "k garne vanera guide garnu hos"]
    return [(b, "status_check_general") for b in base]

# ---- FALLBACK / UNCLEAR ----
def gen_fallback_en():
    base = ["asdkjasd", "what", "huh", "idk", "hmm", "test", "asdf", "random text here",
            "does this thing work", "are you a real person", "what can you do",
            "who made you", "tell me a joke", "what's the weather like",
            "can you sing a song", "what's your favorite food", "how old are you",
            "blah blah blah", "123456", "this is not related to earthquake"]
    return [(b, "fallback_unclear") for b in base]

def gen_fallback_ne():
    base = ["के हो यो", "अहँ", "थाहा छैन", "जाँच्दैछु", "अनि", "तिमी को हौ",
            "तिमीले के के गर्न सक्छौ", "गीत गाउन सक्छौ", "मौसम कस्तो छ",
            "जोक भन", "तिमी कति उमेरको हौ", "क क क", "यो भूकम्पसँग सम्बन्धित छैन",
            "जे पनि टाइप गर्दैछु"]
    return [(b, "fallback_unclear") for b in base]

def gen_fallback_mixed():
    base = ["k ho yo bot", "tapai k k garna saknu huncha", "gana gauna saknu huncha",
            "mausam kasto cha", "joke bhanna saknu huncha", "tapai kati umer ko hunuhuncha",
            "yo bhukampa sanga related xaina", "just testing 123", "random type gardai xu"]
    return [(b, "fallback_unclear") for b in base]


GEN_MAP = {
    "greeting": (gen_greeting_en, gen_greeting_ne, gen_greeting_mixed),
    "goodbye_thanks": (gen_goodbye_en, gen_goodbye_ne, gen_goodbye_mixed),
    "sos_help_request": (gen_sos_en, gen_sos_ne, gen_sos_mixed),
    "earthquake_occurring_report": (gen_eq_en, gen_eq_ne, gen_eq_mixed),
    "trapped_debris_report": (gen_trapped_en, gen_trapped_ne, gen_trapped_mixed),
    "medical_emergency_request": (gen_medical_en, gen_medical_ne, gen_medical_mixed),
    "injury_report": (gen_injury_en, gen_injury_ne, gen_injury_mixed),
    "fire_incident_report": (gen_fire_en, gen_fire_ne, gen_fire_mixed),
    "gas_leak_report": (gen_gas_en, gen_gas_ne, gen_gas_mixed),
    "building_collapse_report": (gen_collapse_en, gen_collapse_ne, gen_collapse_mixed),
    "building_damage_check": (gen_damage_check_en, gen_damage_check_ne, gen_damage_check_mixed),
    "safe_location_query": (gen_safeloc_en, gen_safeloc_ne, gen_safeloc_mixed),
    "shelter_request": (gen_shelter_en, gen_shelter_ne, gen_shelter_mixed),
    "evacuation_guidance_query": (gen_evac_en, gen_evac_ne, gen_evac_mixed),
    "family_member_missing": (gen_missing_en, gen_missing_ne, gen_missing_mixed),
    "family_reunification_status": (gen_reunify_en, gen_reunify_ne, gen_reunify_mixed),
    "food_water_request": (gen_foodwater_en, gen_foodwater_ne, gen_foodwater_mixed),
    "first_aid_query": (gen_firstaid_en, gen_firstaid_ne, gen_firstaid_mixed),
    "aftershock_information_query": (gen_aftershock_en, gen_aftershock_ne, gen_aftershock_mixed),
    "emergency_contact_request": (gen_contact_en, gen_contact_ne, gen_contact_mixed),
    "power_outage_report": (gen_power_en, gen_power_ne, gen_power_mixed),
    "road_blockage_report": (gen_road_en, gen_road_ne, gen_road_mixed),
    "preparedness_tips_query": (gen_prep_en, gen_prep_ne, gen_prep_mixed),
    "status_check_general": (gen_status_en, gen_status_ne, gen_status_mixed),
    "fallback_unclear": (gen_fallback_en, gen_fallback_ne, gen_fallback_mixed),
}

def build_language_dataset(lang_index):
    rows = []
    for intent, fns in GEN_MAP.items():
        fn = fns[lang_index]
        rows.extend(fn())
    return dedupe_keep_order(rows)


# ---------------------------------------------------------------------------
# 4. REALISTIC NOISE AUGMENTATION
#    Simulates panic typing / typos / dropped punctuation / abbreviation-style
#    suffixes. Applied to base rows so the corpus grows with genuinely
#    different literal strings (not semantic duplicates).
# ---------------------------------------------------------------------------
def _drop_char(s):
    if len(s) < 4:
        return s
    i = random.randint(1, len(s) - 2)
    return s[:i] + s[i+1:]

def _double_char(s):
    if len(s) < 3:
        return s
    i = random.randint(1, len(s) - 2)
    return s[:i] + s[i] + s[i:]

def _swap_adjacent(s):
    if len(s) < 4:
        return s
    i = random.randint(1, len(s) - 3)
    lst = list(s)
    lst[i], lst[i+1] = lst[i+1], lst[i]
    return "".join(lst)

def _drop_punct_and_lower(s):
    return "".join(ch for ch in s if ch not in ".,!?").lower()

def _panic_suffix(s):
    suff = random.choice([" pls", " plz", " asap", " help", " now", "!!!", "???", " urgent pls"])
    return s.rstrip(".!? ") + suff

def _no_space_run_on(s):
    words = s.split(" ")
    if len(words) < 3:
        return s
    i = random.randint(0, len(words) - 2)
    words[i] = words[i] + words[i+1]
    del words[i+1]
    return " ".join(words)

LATIN_OPS = [_drop_char, _double_char, _swap_adjacent, _drop_punct_and_lower, _panic_suffix, _no_space_run_on]

def _ne_suffix_variant(s):
    suff = random.choice([" है", " प्लिज", " छिटो", "!!", "???", " हजुर"])
    return s + suff

def _ne_no_space(s):
    words = s.split(" ")
    if len(words) < 2:
        return s
    i = random.randint(0, len(words) - 2)
    words[i] = words[i] + words[i+1]
    del words[i+1]
    return " ".join(words)

NE_OPS = [_ne_suffix_variant, _ne_no_space]

def augment(rows, ops, variants_per_row):
    augmented = list(rows)
    for text, intent in rows:
        made = 0
        attempts = 0
        local_seen = set()
        while made < variants_per_row and attempts < variants_per_row * 4:
            attempts += 1
            op = random.choice(ops)
            new_text = op(text)
            key = new_text.strip().lower()
            if new_text != text and key not in local_seen:
                local_seen.add(key)
                augmented.append((new_text, intent))
                made += 1
    return augmented


def cap_per_intent(rows, cap):
    """Keep dataset balanced: if an intent has more base rows than `cap`,
    deterministically sample down to `cap` rather than let combinatorial
    slot-filling (e.g. family x location grids) over-represent it."""
    by_intent = {}
    for text, intent in rows:
        by_intent.setdefault(intent, []).append((text, intent))
    out = []
    for intent, lst in by_intent.items():
        if len(lst) > cap:
            out.extend(random.sample(lst, cap))
        else:
            out.extend(lst)
    return out


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in rows:
            w.writerow(r)


# ---------------------------------------------------------------------------
# 5. KEYWORDS
#    keyword,intent,language  (~500 total, hand-curated per intent, no dupes)
# ---------------------------------------------------------------------------
KEYWORDS = {
    "greeting": {
        "en": ["hi", "hello", "hey", "good morning", "good evening", "good afternoon",
               "namaste", "greetings", "yo", "hiya"],
        "ne": ["नमस्ते", "नमस्कार", "हेल्लो", "शुभ प्रभात", "शुभ साँझ", "सुप्रभात",
               "के छ हाल", "आदाब", "हजुर नमस्ते", "नमस्ते जी"],
    },
    "goodbye_thanks": {
        "en": ["thank you", "thanks", "thanks a lot", "bye", "goodbye", "appreciate it",
               "thnx", "much appreciated", "ok bye", "take care"],
        "ne": ["धन्यवाद", "धेरै धन्यवाद", "बाई", "फेरि भेटौंला", "ठिक छ धन्यवाद",
               "सहयोगको लागि धन्यवाद", "धन्यबाद है", "दाई धन्यवाद", "बहिनी धन्यवाद", "ओके धन्यवाद"],
    },
    "sos_help_request": {
        "en": ["help", "help me", "sos", "emergency", "urgent help", "need help",
               "please help", "send help", "help now", "help asap", "rescue me",
               "somebody help", "help required"],
        "ne": ["सहयोग", "मद्दत", "सहयोग गर्नुहोस्", "मद्दत चाहियो", "बचाउनुहोस्",
               "एस ओ एस", "छिटो मद्दत चाहियो", "मलाई बचाउनुहोस्", "हामीलाई मद्दत चाहियो",
               "मद्दत पठाउनुहोस्"],
    },
    "earthquake_occurring_report": {
        "en": ["earthquake", "tremor", "shaking", "quake", "ground shaking",
               "earthquake now", "strong tremor", "quake alert", "seismic shaking",
               "earthquake happening"],
        "ne": ["भूकम्प", "भूकम्प गयो", "भूकम्प आयो", "भूइँ हल्लियो", "घर हल्लियो",
               "जोडदार धक्का", "भूकम्पको धक्का", "जोडदार भूकम्प", "अहिले भूकम्प", "धक्का"],
    },
    "trapped_debris_report": {
        "en": ["trapped", "stuck", "buried", "rubble", "debris", "trapped under debris",
               "pinned", "collapsed wall", "cannot move", "stuck inside"],
        "ne": ["थुनिएको", "पुरिएको", "भग्नावशेष", "पर्खालमुनि थुनिएँ", "फसेको",
               "हल्लन सक्दिन", "उद्धार चाहियो", "थिचेको छ", "छत खसेर", "फसियौं"],
    },
    "medical_emergency_request": {
        "en": ["ambulance", "medical emergency", "unconscious", "not breathing",
               "chest pain", "heart attack", "critical patient", "need doctor",
               "severe bleeding", "collapsed"],
        "ne": ["एम्बुलेन्स", "मेडिकल इमर्जेन्सी", "बेहोस", "सास फेर्न सकिरहेको छैन",
               "छातीमा दुखाइ", "डाक्टर चाहियो", "रगत बगिरहेको", "गम्भीर बिरामी"],
    },
    "injury_report": {
        "en": ["injured", "injury", "bleeding", "broken arm", "head injury",
               "cut", "wound", "sprained ankle", "burned hand", "hurt"],
        "ne": ["चोट लागेको", "घाउ", "रगत बगिरहेको", "हात भाँचिएको", "टाउकोमा चोट",
               "गोडा मर्केको", "पोलेको", "गम्भीर चोट"],
    },
    "fire_incident_report": {
        "en": ["fire", "fire broke out", "building on fire", "smoke", "burning",
               "electrical fire", "kitchen fire", "fire brigade", "flames"],
        "ne": ["आगलागी", "आगो लागेको", "आगो", "धुवाँ", "बलिरहेको", "दमकल चाहियो",
               "भान्सामा आगो", "आगो फैलिँदैछ"],
    },
    "gas_leak_report": {
        "en": ["gas leak", "gas smell", "cylinder leaking", "gas pipe broke",
               "smell of gas", "leaking gas", "gas cylinder"],
        "ne": ["ग्यास चुहावट", "ग्यासको गन्ध", "सिलिन्डर चुहावट", "ग्यास चुहियो",
               "ग्यासको पाइप", "ग्यास चुहिँदैछ"],
    },
    "building_collapse_report": {
        "en": ["building collapsed", "house collapsed", "roof caved in",
               "wall collapsed", "structure collapsed", "apartment collapsed"],
        "ne": ["घर भत्कियो", "भवन ढल्यो", "छत खस्यो", "पर्खाल भत्कियो", "संरचना भत्कियो"],
    },
    "building_damage_check": {
        "en": ["cracks in wall", "is it safe to re-enter", "structural damage",
               "building tilted", "safety inspection", "cracks appeared"],
        "ne": ["चिरा परेको", "सुरक्षित छ कि", "भवनको सुरक्षा जाँच", "भवन ढल्किएको",
               "पर्खालमा चिरा"],
    },
    "safe_location_query": {
        "en": ["safe place", "safe zone", "evacuation point", "open ground",
               "assembly point", "nearest safe zone", "where to go for safety"],
        "ne": ["सुरक्षित ठाउँ", "सुरक्षित क्षेत्र", "खुल्ला ठाउँ", "भेला हुने ठाउँ",
               "सुरक्षाको लागि कहाँ जाने"],
    },
    "shelter_request": {
        "en": ["shelter", "temporary shelter", "relief camp", "tent camp",
               "displaced", "need tents", "place to stay"],
        "ne": ["आश्रय", "अस्थायी आश्रय", "राहत शिविर", "पाल शिविर", "विस्थापित",
               "बस्ने ठाउँ"],
    },
    "evacuation_guidance_query": {
        "en": ["evacuate", "evacuation route", "evacuation plan", "evacuation instructions",
               "leave the building safely"],
        "ne": ["निकासा", "निकासाको मार्ग", "निकासा योजना", "निकासाका निर्देशन"],
    },
    "family_member_missing": {
        "en": ["missing", "cannot find", "lost contact", "missing person",
               "not reachable", "did not come home"],
        "ne": ["बेपत्ता", "भेट्टाउन सकिएको छैन", "सम्पर्क टुटेको", "फोन लाग्दैन",
               "घर आउनुभएको छैन"],
    },
    "family_reunification_status": {
        "en": ["found safe", "reunited", "located safely", "family reunification",
               "report found person"],
        "ne": ["सुरक्षित भेटियो", "पुनर्मिलन", "फेला परेको", "स्थिति अपडेट"],
    },
    "food_water_request": {
        "en": ["drinking water", "food supplies", "ration", "no food", "clean water",
               "food distribution", "baby formula"],
        "ne": ["खानेपानी", "खाद्य सामग्री", "खाद्यान्न", "खाना छैन", "सफा पानी",
               "खाद्य वितरण"],
    },
    "first_aid_query": {
        "en": ["first aid", "stop bleeding", "cpr", "bandage wound", "treat burn",
               "sprain treatment", "choking help"],
        "ne": ["प्राथमिक उपचार", "रगत बग्न रोक्ने", "सी पी आर", "पट्टी बाँध्ने",
               "पोलेको उपचार"],
    },
    "aftershock_information_query": {
        "en": ["aftershock", "aftershocks", "more tremors", "another earthquake",
               "aftershock warning", "aftershock update"],
        "ne": ["पराकम्प", "थप धक्का", "अर्को भूकम्प", "पराकम्प चेतावनी"],
    },
    "emergency_contact_request": {
        "en": ["ambulance number", "police number", "fire brigade number",
               "emergency contact", "helpline number", "rescue number"],
        "ne": ["एम्बुलेन्स नम्बर", "प्रहरी नम्बर", "दमकल नम्बर", "हेल्पलाइन नम्बर"],
    },
    "power_outage_report": {
        "en": ["power outage", "no electricity", "electricity cut off",
               "power lines down", "power restored"],
        "ne": ["बिजुली गएको", "बिजुली छैन", "बिजुली कटौती", "तार खसेको"],
    },
    "road_blockage_report": {
        "en": ["road blocked", "landslide", "bridge collapsed", "road cracked",
               "highway blocked", "road damaged"],
        "ne": ["सडक बन्द", "पहिरो", "पुल भत्कियो", "सडक चिरा", "राजमार्ग बन्द"],
    },
    "preparedness_tips_query": {
        "en": ["earthquake go bag", "emergency kit", "secure furniture",
               "preparedness tips", "earthquake drill", "family meeting point"],
        "ne": ["गो-ब्याग", "आपतकालीन किट", "फर्निचर सुरक्षा", "तयारी सुझाव",
               "भूकम्प अभ्यास"],
    },
    "status_check_general": {
        "en": ["what should i do now", "next steps", "current situation",
               "what to do after earthquake", "guide me"],
        "ne": ["अहिले के गर्ने", "अर्को चरण", "अहिलेको अवस्था", "मार्गदर्शन गर्नुहोस्"],
    },
    "fallback_unclear": {
        "en": ["test", "random text", "not related", "unclear message", "unrecognized input"],
        "ne": ["के हो यो", "थाहा छैन", "अनि", "सम्बन्धित छैन"],
    },
}

if __name__ == "__main__":
    from collections import Counter

    CAP_EN_NE = 22
    VAR_EN_NE = 2
    CAP_MIXED = 22
    VAR_MIXED = 3

    en_base = cap_per_intent(build_language_dataset(0), CAP_EN_NE)
    ne_base = cap_per_intent(build_language_dataset(1), CAP_EN_NE)
    mixed_base = cap_per_intent(build_language_dataset(2), CAP_MIXED)

    en_rows = dedupe_keep_order(augment(en_base, LATIN_OPS, VAR_EN_NE))
    ne_rows = dedupe_keep_order(augment(ne_base, NE_OPS, VAR_EN_NE))
    mixed_rows = dedupe_keep_order(augment(mixed_base, LATIN_OPS, VAR_MIXED))

    random.shuffle(en_rows)
    random.shuffle(ne_rows)
    random.shuffle(mixed_rows)

    write_csv(os.path.join(OUT_DIR, "english_dataset.csv"), ["text", "intent"], en_rows)
    write_csv(os.path.join(OUT_DIR, "nepali_dataset.csv"), ["text", "intent"], ne_rows)
    write_csv(os.path.join(OUT_DIR, "mixed_dataset.csv"), ["text", "intent"], mixed_rows)

    # keywords.csv
    kw_rows = []
    seen_kw = set()
    for intent, langs in KEYWORDS.items():
        for lang_code, words in langs.items():
            for w in words:
                key = (w.strip().lower(), intent)
                if key not in seen_kw:
                    seen_kw.add(key)
                    kw_rows.append((w, intent, lang_code))

    # Extend keywords using already-verified location/family vocabulary,
    # tied to the intents where they are genuinely diagnostic (place names
    # for location/report intents, kinship terms for missing/medical/injury
    # intents) -- not arbitrary padding.
    extra_targets = [
        (LOCATIONS_EN, "en", ["earthquake_occurring_report", "safe_location_query"]),
        (LOCATIONS_NE, "ne", ["earthquake_occurring_report", "safe_location_query"]),
        (FAMILY_EN, "en", ["family_member_missing", "medical_emergency_request"]),
        (FAMILY_NE, "ne", ["family_member_missing", "medical_emergency_request"]),
    ]
    for vocab, lang_code, intents_for in extra_targets:
        for w in vocab:
            for intent in intents_for:
                key = (w.strip().lower(), intent)
                if key not in seen_kw:
                    seen_kw.add(key)
                    kw_rows.append((w, intent, lang_code))

    write_csv(os.path.join(OUT_DIR, "keywords.csv"), ["keyword", "intent", "language"], kw_rows)

    # labelled_dataset.csv : id, language, text, intent, source
    labelled = []
    idx = 1
    for text, intent in en_rows:
        labelled.append((idx, "en", text, intent, "english_dataset.csv")); idx += 1
    for text, intent in ne_rows:
        labelled.append((idx, "ne", text, intent, "nepali_dataset.csv")); idx += 1
    for text, intent in mixed_rows:
        labelled.append((idx, "mixed", text, intent, "mixed_dataset.csv")); idx += 1
    write_csv(os.path.join(OUT_DIR, "labelled_dataset.csv"),
              ["id", "language", "text", "intent", "source"], labelled)

    # training_dataset.csv : text, intent, split (80/20 stratified per intent)
    by_intent_all = {}
    for _id, lang, text, intent, source in labelled:
        by_intent_all.setdefault(intent, []).append(text)
    training_rows = []
    for intent, texts in by_intent_all.items():
        texts = list(texts)
        random.shuffle(texts)
        cut = max(1, int(len(texts) * 0.8))
        for t in texts[:cut]:
            training_rows.append((t, intent, "train"))
        for t in texts[cut:]:
            training_rows.append((t, intent, "validation"))
    random.shuffle(training_rows)
    write_csv(os.path.join(OUT_DIR, "training_dataset.csv"), ["text", "intent", "split"], training_rows)

    print("FINAL COUNTS")
    print("english_dataset.csv:", len(en_rows))
    print("nepali_dataset.csv:", len(ne_rows))
    print("mixed_dataset.csv:", len(mixed_rows))
    print("keywords.csv:", len(kw_rows))
    print("labelled_dataset.csv:", len(labelled))
    print("training_dataset.csv:", len(training_rows))
    train_n = sum(1 for r in training_rows if r[2] == "train")
    val_n = sum(1 for r in training_rows if r[2] == "validation")
    print("  train:", train_n, " validation:", val_n)
    print()
    print("Per-intent EN counts:", Counter([i for _, i in en_rows]))
    print("Per-intent NE counts:", Counter([i for _, i in ne_rows]))
    print("Per-intent MIXED counts:", Counter([i for _, i in mixed_rows]))
