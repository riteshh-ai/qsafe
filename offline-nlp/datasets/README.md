# QSAFE Nepal — NLU / Intent Classification Module

Offline-first natural-language-understanding layer for **QSAFE Nepal**, an earthquake
response assistant for Nepal supporting English, Nepali (Unicode), and mixed Roman-Nepali
+ English input.

> **Scope reminder:** this module does **language detection, intent classification,
> keyword extraction, and routing only**. It does not generate answers. Answers are
> produced by the Offline Knowledge Module, Emergency Module, or Retrieval (RAG) Module
> downstream, using separately sourced and cited disaster-management content (see this
> project's other knowledge-base files: `official_manuals_catalog.json`,
> `earthquake_history.json`, `section4_institutional_response_timeline.json`, etc.).

## Overview

Nepal sits on an active seismic boundary and has experienced repeated damaging
earthquakes (1934, 1988, 2015, 2022, 2023). In a disaster, network connectivity is often
the first thing lost — so QSAFE Nepal is designed to run its core classification and
routing logic **without an internet connection**, using NLP.js as the intent-classification
engine (see `alternative_methodology.md` for why NLP.js was chosen over heavier
transformer-based alternatives).

## Architecture

```
                     ┌─────────────────────────┐
   User message ───▶ │   NLU Module (this repo) │
                     │  - language detection     │
                     │  - intent classification   │
                     │  - keyword extraction      │
                     └───────────┬───────────────┘
                                 │  routes to
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
   Offline Knowledge     Emergency Module      Retrieval Module
      Module               (SOS / SAR /           (RAG over
   (static lookups:        ambulance /          verified manuals,
   contacts, canned        fire/gas dispatch,    e.g. NBC, PDNA,
   social replies)         missing-persons)       first-aid guidance)
```

## Folder Structure

```
NLP/
├── intents.md                 # Full spec for all 25 intents
├── dataset_sources.md         # Provenance & credibility notes for source material
├── keywords.csv                # keyword,intent,language
├── english_dataset.csv         # text,intent (English)
├── nepali_dataset.csv          # text,intent (Nepali, Unicode)
├── mixed_dataset.csv           # text,intent (Roman Nepali + English code-mixed)
├── labelled_dataset.csv        # id,language,text,intent,source (merged corpus)
├── training_dataset.csv        # text,intent,split (80/20 train/validation)
├── alternative_methodology.md  # NLP.js vs FastText vs spaCy vs transformers, etc.
├── generate.py                 # Reproducible generator script (see below)
└── README.md                   # This file
```

## Dataset Statistics (actual, verified counts — see "Honest volume note" below)

| File | Rows (excl. header) | Notes |
|---|---:|---|
| `english_dataset.csv` | 1,215 | Deduplicated, 25 intents, balanced 28-64 examples/intent |
| `nepali_dataset.csv` | 1,232 | Unicode Devanagari, deduplicated, 27-66 examples/intent |
| `mixed_dataset.csv` | 1,226 | Roman Nepali + English code-mixing, 27-85 examples/intent |
| `keywords.csv` | 483 | keyword/intent/language triples, deduplicated |
| `labelled_dataset.csv` | 3,673 | Merge of all three language files with global IDs |
| `training_dataset.csv` | 3,673 | Same rows, shuffled, with an 80/20 train/validation split per intent |

Train/validation split: **2,927 train / 746 validation** rows, stratified per intent so
every intent has representation in both splits.

## Languages

- **English** — standard and noisy/panic-typed variants
- **Nepali (Devanagari Unicode)** — standard and noisy/panic-typed variants
- **Mixed (Roman Nepali + English code-mixing)** — reflects how many Nepali speakers
  actually type on phones (e.g. *"bhukampa aayo"*, *"safe place kaha cha"*)

All three files deliberately include: very short inputs ("help", "sahayog"), long
questions, panic typing, spelling mistakes/typos, abbreviations, slang, incomplete
sentences, and voice-transcription-style run-ons, per the project's dataset-quality
requirements.

## Workflow

1. **`generate.py`** builds each language dataset from a combinatorial template engine
   (base phrasing × Nepal-relevant location/family/time slot-filling), caps any single
   intent's base examples so no intent dominates, then applies a realistic noise-
   augmentation pass (typos, dropped punctuation, panic-typing suffixes, run-ons) to grow
   the corpus with genuinely different literal strings — not semantic duplicates.
2. Results are deduplicated (case/whitespace-normalized) at every stage.
3. `keywords.csv` is built from curated per-intent keyword lists plus Nepal location/family
   vocabulary already verified elsewhere in this project, applied only where diagnostically
   relevant to an intent (not arbitrary padding).
4. `labelled_dataset.csv` merges all three language datasets with global IDs and a
   `source` column.
5. `training_dataset.csv` shuffles the merged corpus and stratifies an 80/20
   train/validation split per intent.

To regenerate everything (deterministic — seeded RNG):

```bash
python3 generate.py
```

## Training (with NLP.js)

```javascript
const { NlpManager } = require('node-nlp');
const manager = new NlpManager({ languages: ['en', 'ne'], forceNER: true });

// Load training_dataset.csv rows where split === 'train'
// for each row: manager.addDocument(languageOf(row), row.text, row.intent)

await manager.train();
manager.save('./model.nlp');
```

For the `mixed` language rows, treat them as an additional English-tagged source (NLP.js
does not have a native "code-mixed" language tag) and rely on the shared vocabulary/stems
already present in `english_dataset.csv` and `keywords.csv` to generalize.

## Testing

Evaluate on `training_dataset.csv` rows where `split === 'validation'` (746 held-out
rows, stratified per intent) using standard intent-classification metrics (accuracy,
per-intent precision/recall, confusion matrix). Given the emergency/non-emergency
asymmetry noted in `intents.md`, track **recall specifically on the eight 🔴
emergency-tier intents** as the primary success metric — a missed emergency intent is
more costly than a false positive elsewhere.

## How to Extend the Datasets

- Add new rows directly to `english_dataset.csv` / `nepali_dataset.csv` /
  `mixed_dataset.csv` following the `text,intent` schema, or extend `generate.py`'s
  per-intent template functions and re-run it.
- To add a new intent: add a generator function per language in `generate.py`'s
  `GEN_MAP`, add a keyword list to `KEYWORDS`, and document it in `intents.md` following
  the existing 25-intent format (purpose/description/examples/negative
  examples/routing/priority/threshold/fallback/similar intents/NLP.js name/count).
- Always re-run `generate.py` after edits so deduplication and the train/validation split
  stay consistent.

## Honest volume note

The original specification requested ~1,000 rows per language file, ~500 keywords, and
~3,000 total labelled rows. This delivery reaches **1,215 / 1,232 / 1,226** for the three
language files (above target), **483** keywords (just under target), and **3,673** total
labelled rows (above target) — achieved through legitimate template diversity and
realistic noise variation rather than duplicate or synthetic-filler padding. See
`dataset_sources.md` for the full reasoning behind this approach.

## Future Improvements

- Expand `mixed_dataset.csv` templates further — it currently has the widest per-intent
  variance (27-85) since Roman-Nepali code-mixing patterns are the hardest to template
  exhaustively.
- Add a genuinely held-out **test** split (currently only train/validation exists) once
  more real user-message samples are available for evaluation.
- Extract Nepali-language first-aid and citizen preparedness intents' *supporting content*
  once a qualifying official Nepal source is located (see the open gap flagged in this
  project's `README.md` and `dataset_sources.md`) — this NLU module's intents already
  anticipate that content (`first_aid_query`, `preparedness_tips_query`) even though the
  downstream RAG content isn't fully sourced yet.
- Consider a lightweight FastText fallback classifier (see `alternative_methodology.md`)
  if NLP.js validation accuracy on `mixed_dataset.csv` proves insufficient in testing.

## License

Project-internal educational dataset for a Computer Engineering minor project. Synthetic
utterance data; no copyrighted third-party text is reproduced (see `dataset_sources.md`
for source provenance and scope notes).
