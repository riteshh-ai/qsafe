# QSAFE Nepal — Dataset Sources & Provenance

This file documents where the *concepts, terminology, and factual grounding* behind this
NLU dataset come from. Per the project architecture, **this NLP module does not answer
questions** — it only classifies intent and routes to the Offline Knowledge Module,
Emergency Module, or Retrieval (RAG) Module. The sources below informed (a) which intents
exist, (b) which Nepal-specific terms and phase-structure appear in the data, and (c)
which organizations the *downstream* knowledge base should eventually cite. They are
**not** sources the intent classifier itself quotes from — intent examples are synthetic
user utterances, generated to reflect realistic phrasing, not copied text.

| Source | Credibility | Usefulness to this project | Limitations |
|---|---|---|---|
| **NDRRMA** (National Disaster Risk Reduction and Management Authority, Nepal) | High — Nepal's statutory central DRRM authority under the Disaster Risk Reduction and Management Act, 2017 | Provides the institutional phase structure (mitigation/preparedness/response/recovery) reflected in intent grouping; the attached *DRRM Handbook 2082* is treated as primary terminology source per the project brief | NDRRMA's own document library (ndrrma.gov.np) is not well-indexed for direct download via search — as this project's own knowledge-base files note, its site surfaces mostly bulletins, not a manual repository |
| **Government of Nepal** (Ministry of Home Affairs, DUDBC, National Planning Commission) | High — official government publications (National Disaster Response Framework, National Policy for DRR 2018, Nepal Disaster Reports, NBC building codes) | Grounds report-intent vocabulary (structural damage, institutional response timelines, building safety terms) in real government terminology rather than invented jargon | Several manual types the spec anticipates (e.g. a citizen-facing "before/during/after" PDF) were searched for and **not found** as of this dataset's compilation — flagged honestly rather than assumed to exist |
| **USGS** (U.S. Geological Survey) | High — authoritative for seismological facts (magnitude, epicenter, landslide hazard reports) | Used only for historical-event vocabulary (e.g. terms like "aftershock," "epicenter," magnitude framing) that inform the `aftershock_information_query` and `earthquake_occurring_report` intents | US-based, not Nepal-specific — used for globally standard seismological terms only, not for Nepal policy/institutional content |
| **WHO** (World Health Organization) | High — global authority on emergency health guidance | Referenced conceptually for first-aid / medical-emergency terminology framing (e.g. distinguishing "medical emergency" from "injury" from "first aid query" as three separate intents) | No WHO-Nepal-specific earthquake hospital-preparedness PDF was confirmed located in this project's source-gathering phase; treat as general international guidance, not Nepal-official |
| **UNDRR** (UN Office for Disaster Risk Reduction) | High — global DRR standards body (Sendai Framework) | Informs generic DRR-phase vocabulary (mitigation, preparedness, response, recovery) used to organize intents | Global framework language, not Nepal-specific; Nepal's own Disaster Reports (2015/2017/2019) are the more directly authoritative source for Nepal phase-mapping |
| **FEMA** (US Federal Emergency Management Agency) | High for its own jurisdiction; **not Nepal-official** | Referenced only as an example of internationally common preparedness-intent phrasing ("go bag," "drop cover hold," "emergency kit") since — per this project's own source-gathering notes — no equivalent Nepal-government citizen preparedness PDF was confirmed to exist | Must be clearly labeled Tier-3/international, not Nepal-official, if any FEMA-derived *content* (not just intent phrasing) is used downstream in the Retrieval Module |
| **Nepal Red Cross Society / IFRC** | High — operational Nepal disaster-response body with verified public reports (Emergency Appeal reports, DREF reports) | Grounds `shelter_request`, `food_water_request`, and `family_reunification_status` intents in real NRCS operational vocabulary (relief camps, non-food items, family reunification processes) | NRCS's Nepal-specific *earthquake* manuals (distinct from general IFRC appeal reports) were not fully catalogued in this project's source-gathering phase |
| **Ready.gov** (US general public preparedness site) | Moderate — reputable general-public source, not government-of-Nepal | Same role as FEMA above: informs generic preparedness-intent phrasing only | Not Nepal-specific; not used for any Nepal institutional or policy claims |

## Important scope note on intent-example authorship

Every row in `english_dataset.csv`, `nepali_dataset.csv`, and `mixed_dataset.csv` is a
**synthetically constructed example utterance** — written to sound like something a real
person would type, not copied from any of the sources above or from the project's other
knowledge-base files (`earthquake_history.json`, `emergency_contacts.json`,
`section4_institutional_response_timeline.json`, etc.). Location names, family-relation
terms, and general disaster vocabulary draw on real Nepal geography and demographics (e.g.
district names that also appear in this project's `earthquake_history.json` and
`seismic_overview.md`), but the *sentences themselves* are generated user-utterance
templates, not extracted text.

## Honest volume note

The original spec requested ~1000 rows per language file and ~500 keywords. This delivery
contains (after strict de-duplication and per-intent balancing so no single intent
dominates): **1,215 English**, **1,232 Nepali**, **1,226 Mixed** utterances, and **483
keywords**. Rather than pad any file with near-duplicate or synthetic-filler rows purely to
hit round numbers, generation was capped at what could be produced through legitimate
template diversity plus realistic noise variation (typos, panic-typing, dropped
punctuation, run-ons) — which happened to land close to, and in two cases above, the
original targets. See `README.md` for the exact final counts per file and per intent.
