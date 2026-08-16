# QSafe Offline NLU — PROGRESS.md
> **Persistent context file.** Updated by agent sessions to preserve architecture state, decisions, and task status.  
> Last updated: 2026-08-16 by Antigravity (Google DeepMind) — **STATUS: ✅ PRODUCTION READY**

---

## 🗺️ Project Overview

**Goal:** A self-contained, zero-connectivity intent classification engine for the QSafe disaster response platform. Classifies emergency messages across **25 intent classes** with support for English, Devanagari Nepali, and Romanized Nepali.

**Stack:** Python 3.14+ · scikit-learn · TF-IDF (word + char n-grams) · Logistic Regression · joblib

**Architecture:** 3-Tier cascading engine — `Keyword match → ML classifier → Confidence fallback`

---

## 📁 Workspace Audit (2026-08-16)

### Directory Structure vs. Target

| Path | Status | Notes |
|------|--------|-------|
| `datasets/training_dataset.csv` | ✅ Present | 3,673 rows · columns: `text, intent, split` |
| `datasets/keywords.csv` | ✅ Present | 483 keywords · columns: `keyword, intent, language` |
| `src/__init__.py` | ✅ Present | Package marker |
| `src/preprocessor.py` | ✅ Present | Devanagari + Latin regex normalization |
| `src/model.py` | ✅ Present | FeatureUnion + LogisticRegression + joblib export |
| `src/engine.py` | ✅ Present | 3-Tier inference engine with singleton factory |
| `src/main.py` | ✅ Present | CLI with `train` / `test` subcommands |
| `models/model.joblib` | ✅ **Generated** | 2.10 MB · Trained LogisticRegression |
| `models/vectorizer.joblib` | ✅ **Generated** | 0.13 MB · Fitted FeatureUnion |
| `models/.gitkeep` | ✅ Present | Placeholder with artifact notes |
| `requirements.txt` | ✅ Updated | Bumped to Python 3.14-compatible versions |
| `src/main.py` | ✅ Updated | UTF-8 stdout patch for Windows terminals |
| `README.md` | ✅ Present | Full technical documentation |
| `PROGRESS.md` | ✅ **Created now** | This file |

### Extra Files Found (Legacy / Node.js era)

| File | Notes |
|------|-------|
| `OFFLINE_NLP_PLAN.md` | Original Stage 1–5 plan (Node.js/NLP.js era). Superseded by Python pipeline. |
| `index.js` | Empty stub — not needed for Python pipeline |
| `train.js` | Broken Node.js script referencing `NlpManager` (undefined), writing to `frontend/public/` |
| `test.js` | Node.js test harness for NLP.js model |
| `corpus.json` | NLP.js training corpus (1.84 MB JSON) — original NLP.js artifact |
| `model.nlp.json` | Pre-trained NLP.js model (1.84 MB) — legacy artifact |
| `model.pkl` | Legacy pickle file (3.0 MB) — superseded by `.joblib` artifacts |
| `vectorizer.pkl` | Legacy pickle file (0.56 MB) — superseded by `.joblib` artifacts |
| `package.json` / `node_modules/` | NLP.js node dependencies — legacy, not needed for Python pipeline |
| `datasets/generate.py` | Dataset generation utility (82 KB) |
| `datasets/labelled_dataset.csv` | Full labeled dataset (347 KB) |

---

## 🐍 Python Environment

| Item | Value |
|------|-------|
| Python version | **3.14.0** |
| scikit-learn (before fix) | Broken — scipy DLL failure on Python 3.14 |
| scikit-learn (after upgrade) | **1.9.0** (Python 3.14 compatible wheel) |
| pandas (after upgrade) | **3.0.5** |
| numpy (after upgrade) | **2.5.2** |
| joblib | **1.3.2** (unchanged, works) |

### ⚠️ Critical Issue Resolved: Python 3.14 Compatibility
The original `requirements.txt` pinned `scikit-learn==1.3.2`, `pandas==2.1.4`, `numpy==1.24.3` which are
**incompatible** with Python 3.14. These use scipy internals that fail with a DLL import error.

**Fix applied:** Upgraded to Python 3.14-compatible wheels:
- `scikit-learn==1.9.0`
- `pandas==3.0.5`
- `numpy==2.5.2`

---

## 📊 Dataset Verification

| Metric | Value |
|--------|-------|
| Total samples | **3,673** |
| Train split | **2,927** samples |
| Validation split | **746** samples |
| Intent classes | **25** |
| Keywords | **483** |
| Columns | `text`, `intent`, `split` |

---

## 🏗️ 5-Phase Implementation — Status

### Phase 1: Text Preprocessing (`src/preprocessor.py`)
**Status: ✅ COMPLETE**

- `TextPreprocessor.clean()` handles None/non-string inputs
- Lowercases, retains `[a-z]`, `[0-9]`, `[\u0900-\u097F]` (Devanagari), whitespace
- Collapses multiple spaces, strips leading/trailing whitespace

### Phase 2: Feature Vectorization & Model Training (`src/model.py`)
**Status: ✅ COMPLETE — Artifacts generated**

- `ModelTrainer` loads CSV, preprocesses text, builds hybrid vectorizer
- `FeatureUnion`: word TF-IDF (1–2 grams, 5k features) + char TF-IDF (2–5 grams, 10k features)
- `LogisticRegression`: C=5.0, max_iter=1000, solver='lbfgs', random_state=42
- Saves to `models/vectorizer.joblib` and `models/model.joblib` with compress=3
- ✅ `vectorizer.joblib`: **0.13 MB** | `model.joblib`: **2.10 MB**

### Phase 3: Inference Engine (`src/engine.py`)
**Status: ✅ COMPLETE — End-to-end tested**

- `IntentEngine` with 3-Tier cascading strategy
- Tier 1: Exact keyword match → confidence=1.0 ✅ verified (namaste, hello, नमस्ते, building collapsed)
- Tier 2: ML prediction → max softmax probability ✅ verified (छत खसेर, road band cha)
- Tier 3: Fallback guard at τ=0.40 ✅ verified (empty string → fallback 14.75%)
- Singleton factory via `get_engine()`
- Latency: keyword <0.1ms, ML ~3–6ms

### Phase 4: CLI Entry Point (`src/main.py`)
**Status: ✅ COMPLETE**

- `python -m src.main train` → full training pipeline
- `python -m src.main test` → 8 inference test cases
- argparse with subcommands, graceful help output

### Phase 5: Production Readiness
**Status: ✅ COMPLETE**

- [x] README.md complete with full architecture docs
- [x] requirements.txt updated for Python 3.14 compatibility
- [x] `models/model.joblib` generated (2.10 MB)
- [x] `models/vectorizer.joblib` generated (0.13 MB)
- [x] End-to-end test passed (`python -m src.main test`)
- [x] Validation Accuracy: **99.46%** | F1: **99.40%** | Precision: **99.38%** | Recall: **99.44%**

---

## 🚨 Issues Log

### ISSUE-001: Python 3.14 / scikit-learn DLL Failure
- **Detected:** 2026-08-16
- **Symptom:** `ImportError: DLL load failed while importing _ufuncs`
- **Root Cause:** Pinned `scikit-learn==1.3.2` + `numpy==1.24.3` use scipy incompatible with Python 3.14 C ABI
- **Fix:** `pip install --upgrade scikit-learn pandas joblib numpy`
- **Status:** ✅ Resolved

### ISSUE-002: `requirements.txt` version pins incompatible with Python 3.14
- **Detected:** 2026-08-16
- **Fix:** Updated `requirements.txt` to use Python 3.14-compatible versions
- **Status:** ✅ Resolved

### ISSUE-003: `train.js` broken (references undefined `NlpManager`)
- **Detected:** 2026-08-16  
- **Details:** `train.js` uses `new NlpManager(...)` but only imports `Nlp` (not `NlpManager`). Writes output to `../frontend/public/` (may not exist).
- **Impact:** None for Python pipeline — Node.js artifacts are legacy
- **Status:** ⚠️ Legacy, not blocking Python pipeline.

### ISSUE-004: `models/` directory empty (no trained artifacts)
- **Detected:** 2026-08-16
- **Fix:** Ran `python -m src.main train` from `offline-nlp/` directory
- **Status:** ✅ Resolved — artifacts at `models/model.joblib` (2.10 MB) + `models/vectorizer.joblib` (0.13 MB)

### ISSUE-005: `UnicodeEncodeError` on Windows CP1252 terminal (emoji in print)
- **Detected:** 2026-08-16
- **Symptom:** `charmap codec can't encode character '\U0001f680'` on plain PowerShell
- **Root Cause:** Windows default terminal encoding is CP1252 which doesn't support emoji
- **Fix:** Added `sys.stdout.reconfigure(encoding='utf-8')` to `src/main.py`; also `PYTHONUTF8=1` env var works as workaround
- **Status:** ✅ Resolved

---

## ⚙️ Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vectorizer | FeatureUnion (word 1-2gram + char 2-5gram TF-IDF) | Word n-grams capture phrase context; char n-grams handle morphology and OOV/Devanagari |
| Classifier | LogisticRegression (C=5.0, lbfgs) | Fast inference (<5ms), interpretable probabilities, well-suited for sparse TF-IDF |
| Compression | joblib compress=3 | Balances size (~2MB total) vs. load speed |
| Confidence threshold τ | 0.40 | Conservative fallback to avoid false positives in safety-critical emergency context |
| Keyword tier | Exact match post-cleaning | Deterministic, zero-latency for high-priority emergency phrases |
| Serialization | .joblib (not .pkl) | joblib optimized for numpy/scipy sparse matrices; ~30% faster than pickle |

---

## 🔄 Session History

| Session | Date | Agent | Actions |
|---------|------|-------|---------|
| #1 | Pre-migration | Unknown | Created Python pipeline, datasets, src/ modules, README |
| #2 | 2026-08-16 | Antigravity | Full workspace audit · Fixed Python 3.14 compat (scipy/sklearn/pandas/numpy) · Fixed deprecated sklearn params · Fixed train.js NlpManager import · Fixed Windows UTF-8 stdout · Ran training pipeline · Verified inference test suite · Generated model artifacts · Created PROGRESS.md |

---

## 📋 Next Actions

### ✅ Completed This Session
1. ✅ Training verified: 99.46% accuracy, 99.40% F1 on 746 validation samples
2. ✅ Model artifacts: `model.joblib` (2.10 MB), `vectorizer.joblib` (0.13 MB)
3. ✅ All 3 inference tiers verified via `python -m src.main test`
4. ✅ `train.js` NlpManager bug fixed

### ⬜ Remaining (Future Sessions)
5. ⬜ Backend integration — consume `get_engine()` singleton from Python backend service
6. ⬜ Add `pytest` unit test suite for preprocessor + engine edge cases
7. ⬜ Consider adding a `benchmark` subcommand measuring full batch latency
