# Offline NLP Plan for QSAFE Nepal

## Objective

Create a self-contained offline NLP pipeline inside `offline-nlp/` that trains, evaluates, and exports a serialized intent classification model.

This plan is limited to the offline-NLP workspace only; it does not modify code outside `offline-nlp/`.

---

## Stage 1: Data Inventory and Preparation

1. Inventory available offline-NLP data:
   - confirm `offline-nlp/corpus.json` exists and is the main training corpus
   - identify any additional uploaded intent data that should be merged

2. Create a dataset manifest inside `offline-nlp/`:
   - list all intents
   - count utterances per intent
   - label examples by language: English, Nepali, Romanized Nepali
   - note any missing emergency categories that need more examples

3. Clean and normalize the corpus:
   - deduplicate repeated utterances
   - normalize whitespace and punctuation
   - preserve Nepali Unicode and Romanized phrases
   - keep the NLP.js corpus format intact

4. Reserve a validation set:
   - separate 10-20% of examples for offline validation
   - optionally create `offline-nlp/validation.json` or annotate held-out examples

---

## Stage 2: Training Pipeline Implementation

1. Fix `offline-nlp/train.js` to be fully offline:
   - bootstrap `@nlpjs/core`
   - register `Nlp` and `Language`
   - load `offline-nlp/corpus.json`
   - train the model
   - export serialized JSON

2. Persist the trained model artifact locally:
   - output `offline-nlp/model.nlp.json`
   - keep the pipeline reproducible and contained in `offline-nlp/`

3. Add a developer command in `offline-nlp/package.json`:
   - `"scripts": { "train": "node train.js" }`

4. Validate the training flow locally:
   - ensure `npm run train` succeeds
   - confirm `offline-nlp/model.nlp.json` is produced

---

## Stage 3: Evaluation and Test Harness

1. Create `offline-nlp/test.js`:
   - load `offline-nlp/model.nlp.json`
   - initialize the NLP model with `nlp.fromJSON(...)`
   - run sample queries and report predicted intents

2. Define validation criteria:
   - check correct intent predictions for emergency phrases
   - log confidence scores for each sample
   - identify any low-confidence or incorrect outputs

3. Evaluate held-out examples:
   - run the validation set through `test.js`
   - calculate accuracy and highlight failure cases

4. Iterate corpus if needed:
   - add missing phrasing for failed intents
   - increase examples for weak categories
   - retrain after corpus updates

---

## Stage 4: Export Readiness

1. Document the exported artifact:
   - note that `offline-nlp/model.nlp.json` is the main output
   - if needed, mention a handoff path for downstream integration

2. Keep all runtime artifacts within `offline-nlp/`:
   - do not write or modify frontend files here
   - only document the export location and expected JSON format

3. Add an offline-NLP readme section:
   - include training command and evaluation command
   - describe the corpus format and validation process

---

## Stage 5: Handoff and Future Integration Notes

1. Write a short note in `OFFLINE_NLP_PLAN.md` about next steps:
   - how to use `offline-nlp/model.nlp.json` externally
   - which offline-NLP files are the source of truth (`train.js`, `test.js`, `corpus.json`)

2. Keep integration separate:
   - this plan does not change frontend or backend code
   - if integration is required later, it will consume the exported JSON artifact

---

## Deliverables inside `offline-nlp/`

- `corpus.json` — cleaned and validated training corpus
- `train.js` — offline training script
- `model.nlp.json` — generated model artifact
- `test.js` — evaluation harness for offline validation
- `OFFLINE_NLP_PLAN.md` — structured plan and task breakdown
- `package.json` — developer script for `npm run train`

---

## Success Criteria

- The offline-NLP pipeline runs entirely inside `offline-nlp/`.
- `npm run train` produces `offline-nlp/model.nlp.json`.
- `offline-nlp/test.js` can load the model and classify example queries.
- The training corpus is documented, cleaned, and held-out validation is defined.
- No code outside `offline-nlp/` is modified during this work.

---

## Recommended next actions

1. Review and finalize `offline-nlp/corpus.json`.
2. Implement `offline-nlp/test.js`.
3. Run `npm run train` and verify `offline-nlp/model.nlp.json`.
4. Validate the model on held-out examples and iterate the corpus.
5. Document the process in `OFFLINE_NLP_PLAN.md`.

---

> Note: This plan is intentionally scoped to the `offline-nlp/` folder only. Any frontend or backend integration is outside this phase.
