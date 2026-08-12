# Offline NLP Plan for QSAFE Nepal

## Objective

Build a fully offline NLP intent classification pipeline for the QSAFE Nepal project, from dataset collection through model training, offline browser integration, and validation.

The final goal is to have an offline model that can classify emergency-related user queries locally and drive the frontend’s offline response behavior.

---

## Phase 0: Inventory & Data Collection

1. Gather all available datasets:
   - `offline-nlp/corpus.json`
   - any uploaded or external bilingual emergency intent data
   - Nepal disaster guidelines in `backend/data/ndrrma_guidlines.txt`
   - static safety content in `frontend/public/emergency_contacts.json`

2. Create a dataset manifest:
   - list target intents
   - count utterances per intent
   - label each example by language (English, Nepali, Romanized Nepali)
   - verify coverage for critical disaster categories such as earthquake, landslide, flood, fire, missing person, evacuation, medical emergency, and hotline requests.

3. Confirm dataset quality before training:
   - remove duplicates
   - normalize punctuation and spacing
   - preserve Nepali Unicode and Romanized spellings
   - expand underrepresented intents with more examples if needed

> Do not execute model training until the dataset has been reviewed and finalized.

---

## Phase 1: Data Preparation

1. Prepare the training corpus in `offline-nlp/corpus.json`:
   - ensure it matches NLP.js corpus format
   - include `intent`, `utterances`, and optional `answers` if desired

2. Normalize training text:
   - lowercase all inputs
   - remove extraneous whitespace
   - keep relevant tokens such as emergency keywords
   - optionally add normalized Roman Nepali patterns for the same intent

3. Split data for evaluation:
   - reserve a test set of held-out utterances
   - keep at least 10-20% of examples for validation
   - store the test split separately or annotate it clearly in the corpus manifest

---

## Phase 2: Training the Offline Model

1. Update the `offline-nlp/train.js` pipeline:
   - bootstrap the NLP.js container using `@nlpjs/core`
   - register `Nlp` and `Language`
   - load the corpus data
   - train the model
   - export the serialized model as JSON

2. Generate the model artifact:
   - output to `offline-nlp/model.nlp.json`
   - copy or export to `frontend/public/model.nlp.json`

3. Add developer scripts:
   - `npm run train` in `offline-nlp/package.json`

4. Confirm the model is valid:
   - ensure `model.nlp.json` is written successfully
   - verify the file can be loaded back into NLP.js

---

## Phase 3: Offline Evaluation

1. Create a test harness:
   - add `offline-nlp/test.js`
   - load the serialized model with `nlp.fromJSON(...)`
   - run sample queries from the held-out test set

2. Measure accuracy and confidence:
   - compare predicted intents against expected labels
   - verify `earthquake` and other high-priority intents are recognized reliably
   - observe low-confidence cases and tune thresholds if needed

3. Debug model behavior:
   - inspect where classification fails
   - enrich the corpus with missing phrasings for failure cases

---

## Phase 4: Frontend Offline Integration

1. Load the serialized model in the browser:
   - fetch `frontend/public/model.nlp.json`
   - initialize `@nlpjs` or a compatible lightweight runtime in the frontend
   - call `nlp.fromJSON(...)` to load model state

2. Add an offline query path in `frontend/app.js`:
   - when the app is offline, use the local NLP model first
   - classify the user query into an intent
   - map recognized intents to local safety responses
   - use `emergency_contacts.json` for hotline delivery and checklist output

3. Keep the existing offline fallback for unmatched queries:
   - show a fail-safe advice message when the model cannot classify the input
   - preserve the current local response structure and notification UI

---

## Phase 5: Offline Validation & Testing

1. Test in a browser with network disabled:
   - verify UI still loads
   - confirm offline model inference works for example queries
   - check that the online/offline badge updates correctly

2. Validate the full offline flow:
   - ask earthquake-related questions in English and Nepali
   - test source language detection and intent assignment
   - confirm responses are routed through the offline model and local JSON content

3. Check responsiveness and performance:
   - ensure inference runs quickly enough for a front-end chat interaction
   - identify any issues with model loading latency or memory usage

---

## Phase 6: Deployment & Documentation

1. Document offline training and testing steps:
   - add this plan to `offline-nlp/OFFLINE_NLP_PLAN.md`
   - update `PROJECT_OVERVIEW.md` with the offline NLP workflow if needed

2. Optionally extend the app:
   - add a service worker in `frontend/sw.js` for caching assets and the model file
   - expand the offline dataset with additional disaster categories
   - create intent-to-response mapping for all supported emergencies

3. Prepare handoff notes:
   - note where training occurs (`offline-nlp/train.js`)
   - note where runtime inference occurs (`frontend/app.js`)
   - include instructions for retraining when new data is added

---

## Success Criteria

- A trained offline model exists at `frontend/public/model.nlp.json`.
- The app can classify emergency queries without network access.
- Offline responses are driven by local model inference and static content.
- The model is evaluated against a held-out test set and documented.
- The workflow is repeatable using `npm run train` in `offline-nlp/`.
