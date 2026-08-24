# QSAFE Nepal — Intent Specification (NLU Layer)

This document defines the 25 intents used by the QSAFE Nepal NLP module. This module
does **not** generate answers — it performs language detection, intent classification,
keyword extraction, and routing only. Answers come from the Offline Knowledge Module,
Emergency Module, or Retrieval (RAG) Module, as described in the project architecture.

Terminology (disaster phases, response actions, institutional roles) is aligned with the
NDRRMA Disaster Risk Reduction and Management Handbook 2082 and the QSAFE Nepal Proposal —
e.g. the handbook's mitigation/preparedness/response/recovery phase structure is reflected
in how `preparedness_tips_query` is separated from `status_check_general` (response-phase)
and from the reporting intents (`earthquake_occurring_report`, `building_collapse_report`,
etc.), and the institutional response timeline (Section 4 data in this project) informs
which report intents map to which downstream agency-facing routing.

Suggested global fallback confidence threshold: **0.55** (below this, route to
`fallback_unclear`). Emergency-tier intents (marked 🔴) use a **lower** threshold (0.40)
so panic-typed, garbled, or code-mixed emergency messages are still caught rather than
bounced to fallback — a missed SOS is far costlier than a false positive on this tier.

---

### 1. `greeting`
- **Purpose:** Recognize conversation openers so the bot can respond socially before task routing.
- **Description:** Casual hellos in English, Nepali, or mixed form.
- **Sample utterances:** "hi", "namaste", "hi bhai kasto cha"
- **Negative examples:** "help", "bhukampa aayo"
- **Routing target:** Offline Knowledge Module (canned social response)
- **Priority:** Low
- **Confidence threshold:** 0.55
- **Fallback:** `fallback_unclear`
- **Similar intents:** `goodbye_thanks`
- **NLP.js intent name:** `greeting`
- **Dataset count:** EN 53 / NE 59 / Mixed 59

### 2. `goodbye_thanks`
- **Purpose:** Detect conversation closers and gratitude to end sessions gracefully.
- **Description:** Thanks, sign-offs, closing remarks.
- **Sample utterances:** "thank you", "dhanyabad", "ok bye"
- **Negative examples:** "help me", "sos"
- **Routing target:** Offline Knowledge Module
- **Priority:** Low
- **Confidence threshold:** 0.55
- **Fallback:** `fallback_unclear`
- **Similar intents:** `greeting`
- **NLP.js intent name:** `goodbye.thanks`
- **Dataset count:** EN 58 / NE 58 / Mixed 47

### 3. `sos_help_request` 🔴
- **Purpose:** Catch generic, undirected distress calls that don't specify the emergency type.
- **Description:** Bare "help"-type messages, often panic-typed, with no further detail yet.
- **Sample utterances:** "help", "help pls", "sos sos help", "malai bachau please"
- **Negative examples:** "how to prepare a go bag", "thank you"
- **Routing target:** Emergency Module (triggers a clarifying follow-up + immediate hotline card)
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `status_check_general` (ask "what kind of help do you need?")
- **Similar intents:** `medical_emergency_request`, `trapped_debris_report`
- **NLP.js intent name:** `sos.help`
- **Dataset count:** EN 64 / NE 60 / Mixed 56

### 4. `earthquake_occurring_report` 🔴
- **Purpose:** Detect real-time reports that an earthquake is happening or just happened.
- **Description:** Ground-shaking reports, often in the moment, from any of the three languages.
- **Sample utterances:** "earthquake now", "bhukampa aayo", "घर हल्लियो"
- **Negative examples:** "will there be aftershocks", "earthquake preparedness tips"
- **Routing target:** Emergency Module (log event + trigger immediate safety-instruction card)
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `sos_help_request`
- **Similar intents:** `aftershock_information_query`, `building_collapse_report`
- **NLP.js intent name:** `earthquake.occurring`
- **Dataset count:** EN 61 / NE 66 / Mixed 84

### 5. `trapped_debris_report` 🔴
- **Purpose:** Identify people (or family members) physically trapped and needing rescue.
- **Description:** Being pinned/stuck/buried under rubble, walls, or collapsed structures.
- **Sample utterances:** "trapped under debris", "पर्खालमुनि थुनिएँ", "debris muni thuniyo"
- **Negative examples:** "road blocked by landslide", "is my building safe"
- **Routing target:** Emergency Module (highest-priority rescue dispatch queue)
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `sos_help_request`
- **Similar intents:** `building_collapse_report`, `medical_emergency_request`
- **NLP.js intent name:** `report.trapped`
- **Dataset count:** EN 64 / NE 66 / Mixed 83

### 6. `medical_emergency_request` 🔴
- **Purpose:** Detect requests for ambulance/medical intervention.
- **Description:** Unconsciousness, not breathing, cardiac symptoms, severe bleeding, needing an ambulance.
- **Sample utterances:** "need an ambulance", "एम्बुलेन्स चाहियो", "ambulance chaincha malai"
- **Negative examples:** "how to bandage a wound" (→ first_aid_query), "minor injury on hand" (→ injury_report)
- **Routing target:** Emergency Module (ambulance dispatch)
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `injury_report`
- **Similar intents:** `injury_report`, `first_aid_query`
- **NLP.js intent name:** `request.medical`
- **Dataset count:** EN 64 / NE 66 / Mixed 85

### 7. `injury_report`
- **Purpose:** Capture non-critical injury reports (distinguish from life-threatening medical emergencies).
- **Description:** Cuts, sprains, minor burns, non-critical wounds.
- **Sample utterances:** "i am injured", "मलाई चोट लागेको छ", "khutta ma chot lagyo"
- **Negative examples:** "not breathing", "unconscious"
- **Routing target:** Retrieval Module (first-aid guidance) + optional Emergency Module escalation
- **Priority:** High
- **Confidence threshold:** 0.50
- **Fallback:** `medical_emergency_request`
- **Similar intents:** `medical_emergency_request`, `first_aid_query`
- **NLP.js intent name:** `report.injury`
- **Dataset count:** EN 64 / NE 66 / Mixed 64

### 8. `fire_incident_report` 🔴
- **Purpose:** Detect active fire reports triggered by or following an earthquake.
- **Description:** House/building fires, electrical fires, kitchen fires post-quake.
- **Sample utterances:** "fire broke out after the earthquake", "आगलागी भयो", "aago lagyo bhukampa pachi"
- **Negative examples:** "gas leak in the house" (→ gas_leak_report — precursor, not yet ignited)
- **Routing target:** Emergency Module (fire brigade dispatch)
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `sos_help_request`
- **Similar intents:** `gas_leak_report`, `building_collapse_report`
- **NLP.js intent name:** `report.fire`
- **Dataset count:** EN 54 / NE 66 / Mixed 69

### 9. `gas_leak_report` 🔴
- **Purpose:** Detect gas leak hazards before they escalate to fire/explosion.
- **Description:** Gas smell, leaking cylinders, broken gas pipes.
- **Sample utterances:** "gas leak bhayo", "ग्यास चुहियो", "gas ko smell airaxa"
- **Negative examples:** "fire broke out"
- **Routing target:** Emergency Module (hazard alert) + Retrieval Module (safety steps)
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `fire_incident_report`
- **Similar intents:** `fire_incident_report`
- **NLP.js intent name:** `report.gas_leak`
- **Dataset count:** EN 41 / NE 39 / Mixed 32

### 10. `building_collapse_report` 🔴
- **Purpose:** Detect full/partial structural collapse reports, distinct from cracks (damage_check).
- **Description:** Buildings, houses, roofs, or walls that have come down.
- **Sample utterances:** "building collapsed in Kathmandu", "घर भत्कियो", "ghar bhatkiyo"
- **Negative examples:** "there are cracks in the wall" (→ building_damage_check)
- **Routing target:** Emergency Module (structural collapse → SAR dispatch)
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `trapped_debris_report`
- **Similar intents:** `trapped_debris_report`, `building_damage_check`
- **NLP.js intent name:** `report.building_collapse`
- **Dataset count:** EN 51 / NE 57 / Mixed 45

### 11. `building_damage_check`
- **Purpose:** Handle non-collapsed but potentially unsafe structures (cracks, tilting).
- **Description:** Asking whether a still-standing structure is safe to re-enter or remain in.
- **Sample utterances:** "my house has cracks is it safe", "मेरो घरमा चिरा परेको छ", "mero ghar ma crack aayo"
- **Negative examples:** "building collapsed"
- **Routing target:** Retrieval Module (building-safety-tagging guidance, where sourced)
- **Priority:** Medium
- **Confidence threshold:** 0.55
- **Fallback:** `status_check_general`
- **Similar intents:** `building_collapse_report`
- **NLP.js intent name:** `check.building_damage`
- **Dataset count:** EN 30 / NE 30 / Mixed 36

### 12. `safe_location_query`
- **Purpose:** Help users find the nearest safe/open assembly area.
- **Description:** Requests for safe zones, open ground, designated evacuation points.
- **Sample utterances:** "safe place near me", "नजिकैको सुरक्षित ठाउँ कहाँ छ", "safe place kaha cha"
- **Negative examples:** "need shelter for my family" (→ shelter_request — implies staying, not just going)
- **Routing target:** Retrieval Module (location guidance) / Offline Knowledge Module
- **Priority:** High
- **Confidence threshold:** 0.50
- **Fallback:** `shelter_request`
- **Similar intents:** `shelter_request`, `evacuation_guidance_query`
- **NLP.js intent name:** `query.safe_location`
- **Dataset count:** EN 53 / NE 39 / Mixed 39

### 13. `shelter_request`
- **Purpose:** Detect requests for a place to stay (implies displacement, not just momentary safety).
- **Description:** Temporary shelter, relief camps, tents for displaced families.
- **Sample utterances:** "need shelter for my family", "आश्रय चाहियो", "shelter chaincha mero family ko lagi"
- **Negative examples:** "safe place near me"
- **Routing target:** Retrieval Module + Offline Knowledge Module (relief camp info, where sourced)
- **Priority:** High
- **Confidence threshold:** 0.50
- **Fallback:** `safe_location_query`
- **Similar intents:** `safe_location_query`, `food_water_request`
- **NLP.js intent name:** `request.shelter`
- **Dataset count:** EN 38 / NE 36 / Mixed 40

### 14. `evacuation_guidance_query`
- **Purpose:** Answer "how" questions about evacuating, distinct from "where is safe" queries.
- **Description:** Evacuation routes, steps, plans, instructions.
- **Sample utterances:** "how do i evacuate safely", "निकासाको मार्ग के हो", "kasari safely evacuate garne"
- **Negative examples:** "safe place near me"
- **Routing target:** Retrieval Module
- **Priority:** Medium
- **Confidence threshold:** 0.55
- **Fallback:** `safe_location_query`
- **Similar intents:** `safe_location_query`, `preparedness_tips_query`
- **NLP.js intent name:** `query.evacuation_guidance`
- **Dataset count:** EN 39 / NE 39 / Mixed 35

### 15. `family_member_missing` 🔴
- **Purpose:** Detect missing-person reports for family/friends.
- **Description:** Lost contact, unreachable, hasn't returned home since the earthquake.
- **Sample utterances:** "my mother is missing since the earthquake", "आमा बेपत्ता हुनुभएको छ", "mero didi missing hunuhuncha"
- **Negative examples:** "found my family member safe" (→ family_reunification_status)
- **Routing target:** Emergency Module (missing-persons registry) + Retrieval Module
- **Priority:** Critical
- **Confidence threshold:** 0.40
- **Fallback:** `sos_help_request`
- **Similar intents:** `family_reunification_status`
- **NLP.js intent name:** `report.family_missing`
- **Dataset count:** EN 61 / NE 66 / Mixed 84

### 16. `family_reunification_status`
- **Purpose:** Handle positive updates — a missing person has been found/located.
- **Description:** Reporting a found family member, asking how reunification registration works.
- **Sample utterances:** "found my family member safe", "मेरो परिवारको सदस्य सुरक्षित भेटियो", "mero family member safe bhetiyo"
- **Negative examples:** "my mother is missing"
- **Routing target:** Emergency Module (update registry) + Offline Knowledge Module
- **Priority:** Medium
- **Confidence threshold:** 0.50
- **Fallback:** `family_member_missing`
- **Similar intents:** `family_member_missing`
- **NLP.js intent name:** `report.family_reunited`
- **Dataset count:** EN 63 / NE 66 / Mixed 71

### 17. `food_water_request`
- **Purpose:** Detect requests for food/water supplies.
- **Description:** Drinking water shortage, no food, ration requests, baby formula.
- **Sample utterances:** "need drinking water", "खानेपानी चाहियो", "khane pani chaincha"
- **Negative examples:** "need shelter for my family"
- **Routing target:** Offline Knowledge Module (distribution point info, where sourced) + Emergency Module for severe cases
- **Priority:** High
- **Confidence threshold:** 0.50
- **Fallback:** `shelter_request`
- **Similar intents:** `shelter_request`
- **NLP.js intent name:** `request.food_water`
- **Dataset count:** EN 39 / NE 39 / Mixed 36

### 18. `first_aid_query`
- **Purpose:** Answer how-to questions about administering first aid.
- **Description:** Bleeding control, CPR, bandaging, burns, sprains — knowledge questions, not live emergencies.
- **Sample utterances:** "how to stop bleeding", "रगत बग्न रोक्ने उपाय के हो", "cpr kasari garne"
- **Negative examples:** "someone is not breathing" (→ medical_emergency_request — an active emergency, not a how-to)
- **Routing target:** Retrieval Module (RAG over verified first-aid content)
- **Priority:** Medium
- **Confidence threshold:** 0.55
- **Fallback:** `medical_emergency_request`
- **Similar intents:** `medical_emergency_request`, `injury_report`
- **NLP.js intent name:** `query.first_aid`
- **Dataset count:** EN 30 / NE 27 / Mixed 30

### 19. `aftershock_information_query`
- **Purpose:** Answer questions about the likelihood/nature of aftershocks.
- **Description:** "Will there be more shaking", aftershock duration/strength questions.
- **Sample utterances:** "will there be aftershocks", "के पराकम्प आउने छ", "aftershock aaunxa ki"
- **Negative examples:** "earthquake now" (an event report, not a forward-looking question)
- **Routing target:** Retrieval Module / Offline Knowledge Module
- **Priority:** Medium
- **Confidence threshold:** 0.55
- **Fallback:** `status_check_general`
- **Similar intents:** `earthquake_occurring_report`
- **NLP.js intent name:** `query.aftershock`
- **Dataset count:** EN 37 / NE 39 / Mixed 32

### 20. `emergency_contact_request`
- **Purpose:** Return official emergency phone numbers.
- **Description:** Ambulance/police/fire/Red Cross/NDRRMA contact number lookups.
- **Sample utterances:** "what is the ambulance number", "एम्बुलेन्सको नम्बर के हो", "ambulance ko number k ho"
- **Negative examples:** "need an ambulance" (→ medical_emergency_request — an active dispatch request, not a number lookup)
- **Routing target:** Offline Knowledge Module (static emergency_contacts.json lookup)
- **Priority:** High
- **Confidence threshold:** 0.50
- **Fallback:** `sos_help_request`
- **Similar intents:** `medical_emergency_request`
- **NLP.js intent name:** `query.emergency_contact`
- **Dataset count:** EN 29 / NE 30 / Mixed 27

### 21. `power_outage_report`
- **Purpose:** Log/report electricity outages post-quake.
- **Description:** No power, downed lines, outage duration questions.
- **Sample utterances:** "power outage in Kathmandu", "बिजुली गएको छ", "power outage cha"
- **Negative examples:** "gas leak bhayo"
- **Routing target:** Offline Knowledge Module (utility status, where available) / Emergency Module for downed-line hazard
- **Priority:** Medium
- **Confidence threshold:** 0.55
- **Fallback:** `status_check_general`
- **Similar intents:** `road_blockage_report`
- **NLP.js intent name:** `report.power_outage`
- **Dataset count:** EN 46 / NE 51 / Mixed 32

### 22. `road_blockage_report`
- **Purpose:** Log/report blocked roads, collapsed bridges, landslide-blocked routes.
- **Description:** Impassable roads due to landslide, debris, or structural damage.
- **Sample utterances:** "road blocked by landslide near Gorkha", "सडक बन्द छ", "road block bhayo landslide le"
- **Negative examples:** "power outage"
- **Routing target:** Offline Knowledge Module (routing status) / Emergency Module (SAR access planning)
- **Priority:** Medium
- **Confidence threshold:** 0.55
- **Fallback:** `status_check_general`
- **Similar intents:** `power_outage_report`, `building_collapse_report`
- **NLP.js intent name:** `report.road_blockage`
- **Dataset count:** EN 61 / NE 66 / Mixed 44

### 23. `preparedness_tips_query`
- **Purpose:** Answer proactive, non-emergency "how to prepare" questions.
- **Description:** Go bags, emergency kits, furniture anchoring, family drills.
- **Sample utterances:** "how to prepare an earthquake go bag", "गो-ब्याग कसरी तयार पार्ने", "emergency kit ma k k hunu parxa"
- **Negative examples:** "earthquake now"
- **Routing target:** Retrieval Module (RAG over verified preparedness manuals)
- **Priority:** Low
- **Confidence threshold:** 0.55
- **Fallback:** `status_check_general`
- **Similar intents:** `evacuation_guidance_query`
- **NLP.js intent name:** `query.preparedness`
- **Dataset count:** EN 29 / NE 30 / Mixed 32

### 24. `status_check_general`
- **Purpose:** Catch-all for "what do I do now" when no specific hazard/need is named yet.
- **Description:** General orientation requests during/after a disaster.
- **Sample utterances:** "what should i do now", "अहिले मैले के गर्नुपर्छ", "ahile k garne ma"
- **Negative examples:** "help me" (→ sos_help_request — more urgent framing)
- **Routing target:** Retrieval Module (routes into a guided decision tree)
- **Priority:** Medium
- **Confidence threshold:** 0.50
- **Fallback:** `fallback_unclear`
- **Similar intents:** `sos_help_request`
- **NLP.js intent name:** `query.status_general`
- **Dataset count:** EN 28 / NE 30 / Mixed 30

### 25. `fallback_unclear`
- **Purpose:** Explicit training signal for out-of-scope / unparseable input, so the classifier
  learns to route low-confidence or irrelevant chatter away from emergency intents rather than
  guessing.
- **Description:** Test strings, small talk unrelated to disasters, gibberish, off-topic questions.
- **Sample utterances:** "what", "test", "does this thing work", "yo bhukampa sanga related xaina"
- **Negative examples:** any genuine disaster-related utterance
- **Routing target:** Offline Knowledge Module (default "I can only help with earthquake-related
  questions" response)
- **Priority:** Low
- **Confidence threshold:** N/A (this *is* the fallback)
- **Fallback:** n/a (terminal)
- **Similar intents:** none by design — kept lexically diverse from all other intents
- **NLP.js intent name:** `None` (NLP.js's built-in fallback bucket)
- **Dataset count:** EN 58 / NE 41 / Mixed 34

---

## Design rationale: why 🔴 emergency intents get a lower threshold

A missed emergency-intent classification (false negative) can delay rescue dispatch; a
false positive just triggers an unnecessary clarifying question. That asymmetry is why
`sos_help_request`, `earthquake_occurring_report`, `trapped_debris_report`,
`medical_emergency_request`, `fire_incident_report`, `gas_leak_report`,
`building_collapse_report`, and `family_member_missing` use 0.40 instead of the default
0.55–0.55 band used elsewhere.
