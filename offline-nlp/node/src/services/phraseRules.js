/**
 * High-signal phrase rules — port of `IntentEngine._build_phrase_rules`.
 *
 * ORDER IS SEMANTIC. `_match_phrase_rule` returns the first rule that hits, so earlier
 * entries win ties. Reordering this array changes classifications; keep it byte-for-byte
 * aligned with the Python original.
 *
 * Exact keyword matching is deliberately strict; these rules catch longer field messages
 * that contain an unambiguous emergency phrase, while avoiding broad tokens like "help"
 * that are ambiguous inside greetings.
 */
export const PHRASE_RULES = Object.freeze([
  ['emergency_contact_request', [
    'ambulance number', 'police number', 'fire brigade number',
    'emergency contact', 'helpline number', 'rescue number',
    'hotline', 'phone number for', 'number for ambulance',
    'number for police', 'number for fire',
    'aapatkalin sampark', 'call police', 'prahari aapatkal',
    'prahari bolau', 'prahari sahayata', 'health services',
    'chikitsa aapatkal', 'aspatal sampark', 'swasthya seva',
  ]],
  ['first_aid_query', [
    'first aid', 'cpr', 'resuscitation', 'bandage', 'treat burn',
    'sprain treatment', 'choking help', 'cpr instructions',
    'cpr steps', 'how to stop bleeding', 'stop bleeding',
    'emergency treatment', 'prathamik upchar', 'aapatkalin upchar',
    'chikitsa madat', 'cardiopulmonary', 'punarjivan',
    'ragat rokna', 'ragat rokne', 'ghau herachah', 'patti lagane',
  ]],
  ['medical_emergency_request', [
    'need ambulance', 'call ambulance', 'ambulance please',
    'medical emergency', 'doctor needed', 'hospital needed',
    'urgent medical help', 'unconscious person', 'not breathing',
    'no pulse', 'heart attack', 'chest pain', 'cardiac arrest',
    'severe bleeding', 'heavy bleeding', 'blood loss',
  ]],
  ['gas_leak_report', [
    'gas leak', 'gas smell', 'smell gas', 'smell of gas',
    'cylinder leaking', 'gas pipe broke', 'leaking gas',
    'gas cylinder', 'gas emergency', 'gas explosion',
  ]],
  ['fire_incident_report', [
    'house burning', 'building on fire', 'on fire', 'fire emergency',
    'flames visible', 'smoke coming out', 'smell smoke', 'see fire',
    'need fire brigade', 'call fire department', 'fire truck needed',
    'firefighters help', 'burning building', 'fire blocking exit',
  ]],
  ['trapped_debris_report', [
    'trapped under debris', 'stuck under rubble', 'buried under building',
    'pinned under wall', 'cant move', "can't move", 'stuck here',
    'cant get out', "can't get out", 'trapped inside', 'buried alive',
    'stuck under collapsed building', 'need rescue', 'emergency extraction',
    'family trapped', 'children stuck', 'elderly buried',
    'multiple people trapped', 'fasko', 'dabieko', 'thunieko',
    'people buried', 'bhitra faskaka manis', 'basinda faskaka',
    'adhivasi faskaka', 'manis dabieka',
  ]],
  ['road_blockage_report', [
    'road blocked', 'highway blocked', 'bridge collapsed', 'road cracked',
    'road damaged', 'road closed', 'blocked road', 'blocked highway',
    'landslide', 'mudslide', 'alternate route', 'route blocked',
    'sadak avaruddh', 'rajamarg banda', 'gali avaruddh',
    'marg avaruddh', 'rockfall', 'pahirole avaruddh',
    'sadakama bhagnaveshesh', 'chattan khase', 'mato khase',
    'pul kshatigrast',
  ]],
  ['power_outage_report', [
    'power outage', 'no electricity', 'electricity cut off',
    'power lines down', 'power line down', 'power restored',
    'blackout', 'grid failure', 'electricity gone', 'no power',
    'vidyut chaina', 'vidyut banda', 'bijuli chaina', 'bijuli gayo',
    'vidyut bipalta', 'grid bipalta', 'vidyut kat',
    'vidyut punarsthan', 'vidyut',
  ]],
  ['building_collapse_report', [
    'building collapsed', 'house collapsed', 'roof caved in',
    'wall collapsed', 'structure collapsed', 'apartment collapsed',
    'building fell', 'house fell', 'roof fell', 'wall fell',
    'imarat dhali', 'sanrachana dhali', 'bahumanjila dhali',
    'vyavasayik imarat dhali', 'concrete chunks', 'steel bent',
  ]],
  ['building_damage_check', [
    'cracks in wall', 'structural damage', 'building tilted',
    'safety inspection', 'cracks appeared', 'structural integrity',
    'damage assessment', 'foundation damage', 'wall damage',
    'is my house safe', 'is my building safe', 'safe to reenter',
    'safe to re enter', 'safe to re-enter', 'ghar surakshit',
    'imarat suraksha', 'sanrachanatmak',
    'building inspection needed', 'bhitrama phut', 'adhar kshati',
    'imarat nirikshan', 'can go inside', 'structure sound',
    'imarat sthir',
  ]],
  ['family_reunification_status', [
    'found safe', 'reunited', 'located safely', 'family reunification',
    'report found person', 'person found', 'family found',
    'parivar fela', 'fela par', 'status update family',
    'where is family', 'parivar sthiti', 'parivar surakshit',
    'parivar sthan', 'reunification center', 'reunion location',
    'gathering point', 'punarmilan kendra', 'parivar beththalo',
    'punarmilan sthan',
  ]],
  ['family_member_missing', [
    'missing person', 'missing family', 'cant find family',
    "can't find family", 'cannot find family', 'lost contact',
    'not reachable', 'did not come home', 'lost person',
    'family missing', 'parivar haraeka', 'priyajan haraeka',
    'parivar gum', 'harayeko manis',
    'family lost', 'haraeko vyakti', 'haraeko manis',
    'fela parna sakidaina', 'parivar khoji',
    'last seen location', 'last communication',
  ]],
  ['evacuation_guidance_query', [
    'evacuate', 'evacuation route', 'evacuation plan',
    'evacuation instructions', 'leave the building safely',
    'exit route', 'safe exit', 'how to evacuate',
  ]],
  ['safe_location_query', [
    'safe place', 'safe zone', 'evacuation point', 'open ground',
    'assembly point', 'nearest safe zone', 'where to go for safety',
    'where should i go', 'safe area',
  ]],
  ['shelter_request', [
    'temporary shelter', 'relief camp', 'tent camp', 'need tents',
    'place to stay', 'displaced', 'need shelter',
  ]],
  ['food_water_request', [
    'drinking water', 'food supplies', 'clean water', 'food distribution',
    'baby formula', 'no food', 'need food', 'need water', 'ration',
  ]],
  ['preparedness_tips_query', [
    'earthquake go bag', 'emergency kit', 'secure furniture',
    'preparedness tips', 'earthquake drill', 'family meeting point',
    'go bag', 'prepare for earthquake', 'safety drill',
    'disaster readiness', 'safety tips', 'aapad tayari',
    'aapatkalin kit', 'suraksha tips', 'flashlight batteries',
    'aapatkalin apurti', 'torch battery', 'meeting point',
    'parivar aapatkalin yojana', 'sanchar yojana',
    'drop cover hold on', 'safety procedure',
  ]],
  ['aftershock_information_query', [
    'aftershock', 'aftershocks', 'more tremors', 'another earthquake',
    'second earthquake', 'earthquake again', 'aftershock warning',
    'aftershock update',
  ]],
  ['status_check_general', [
    'current situation', 'whats happening', "what's happening",
    'status update', 'latest news', 'disaster status',
    'emergency status', 'crisis update', 'situation report',
    'area condition', 'local status', 'neighborhood status',
    'community situation', 'safety status', 'is it safe',
    'danger level', 'risk assessment', 'weather condition',
    'rain status', 'wind status', 'communication status',
    'internet status', 'network available', 'resource availability',
    'help available', 'supplies status', 'services running',
    'general information', 'need details', 'want to know',
    'seeking information', 'vartaman sthiti', 'sthiti update',
    'nabintam samachar', 'sankat update',
  ]],
  ['injury_report', [
    'injured', 'injury', 'casualty', 'bleeding', 'broken arm',
    'head injury', 'wound', 'sprained ankle', 'burned hand',
    'hurt', 'gaite', 'chotpat', 'ghayeko',
    'critical condition', 'sano ghau', 'sano pida',
    'thulo ghau', 'gambhir avastha', 'laceration',
  ]],
]);

/** Intent → frontend action hint. Port of `IntentEngine._get_quick_actions`. */
export const ACTION_MAP = Object.freeze({
  // Medical / Rescue emergencies -> Ambulance (102)
  medical_emergency_request: 'show_ambulance_button',
  sos_help_request: 'show_ambulance_button',
  trapped_debris_report: 'show_ambulance_button',
  injury_report: 'show_ambulance_button',
  // Fire emergencies -> Fire Brigade (101)
  fire_incident_report: 'show_fire_button',
  gas_leak_report: 'show_fire_button',
  // Structural / Safety -> Police (100)
  building_collapse_report: 'show_police_button',
  building_damage_check: 'show_police_button',
  road_blockage_report: 'show_police_button',
  power_outage_report: 'show_police_button',
  // Earthquake -> Drop-Cover-Hold guidance
  earthquake_occurring_report: 'show_earthquake_guidance',
  // People-finding
  family_member_missing: 'show_missing_person_form',
  family_reunification_status: 'show_missing_person_form',
  // Survival needs
  shelter_request: 'show_shelter_map',
  food_water_request: 'show_relief_centers',
  evacuation_guidance_query: 'show_evacuation_routes',
  safe_location_query: 'show_shelter_map',
  // Information queries
  first_aid_query: 'show_first_aid_guide',
  preparedness_tips_query: 'show_preparedness_checklist',
  aftershock_information_query: 'show_aftershock_info',
  emergency_contact_request: 'show_emergency_contacts',
});

/** Strong-signal terms for urgency detection. Port of `_detect_urgency`. */
export const URGENCY_KEYWORDS = Object.freeze([
  // English
  'help', 'trapped', 'sos', 'urgent', 'dying', 'blood', 'stuck',
  'immediate', 'emergency', 'fire', 'burning', 'collapse', 'rescue',
  'save', 'ambulance', 'unconscious', 'bleeding', 'crushed', 'buried',
  // Romanized Nepali
  'bachau', 'bachao', 'maddat', 'faseko', 'fasiyau', 'uddhar',
  // Devanagari Nepali
  'मद्दत', 'बचाउ', 'फसे', 'उद्धार', 'बचाउनुहोस्',
]);

/** Major Nepali cities/areas for lightweight location extraction. */
export const LOCATIONS = Object.freeze([
  'kathmandu', 'patan', 'bhaktapur', 'pokhara', 'chitwan', 'dharan',
  'butwal', 'thamel', 'sindhupalchok', 'gorkha', 'lalitpur', 'ktm',
  'काठमाडौं', 'पाटन', 'भक्तपुर', 'पोखरा',
]);

export default { PHRASE_RULES, ACTION_MAP, URGENCY_KEYWORDS, LOCATIONS };
