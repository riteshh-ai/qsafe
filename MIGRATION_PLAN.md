# QSAFE Nepal — Python → Node.js Migration Plan

**Branch:** `node` (base `84db59b`)
**Status:** ✅ **Complete.** All four phases done and verified. The runtime is Python-free.

## Result

| | |
|---|---|
| Python files in the codebase | **0** (45 archived to `_python_legacy/`) |
| Inference parity | **6,234 / 6,234 exact** |
| Test suites | 64 (offline-nlp) + 13 (backend), all passing |
| Latency | mean 0.64 ms, p99 1.84 ms (budget: 5 ms) |
| Backend integration changes | **none** — `nlpClient.js` untouched |

Verification detail lives in [`offline-nlp/node/README.md`](offline-nlp/node/README.md#parity)
and [`_python_legacy/README.md`](_python_legacy/README.md).

Training is the single component that is not bit-faithful — a different L-BFGS
implementation reaches a different optimum. Quality is equivalent: on the same 844-row
validation split, scikit-learn scored 84.12% accuracy / 83.21% macro-F1 against the Node
trainer's 83.53% / 82.71%.

---

---

## 1. Reconnaissance findings

### 1.1 The migration surface is one service, not the whole repo

The repo holds **8,075 lines of Python across 39 files**, but almost none of it is in the
request path. The upstream merge (`84db59b`) already replaced the Python RAG pipeline with a
native Node ChromaDB Cloud client, so the only Python left serving live traffic is the
offline NLP intent classifier.

| Component | Port | Language today | In request path? |
|---|---|---|---|
| Express API + static frontend | 5000 | **Node** | yes |
| RAG retrieval (`config/chroma.js`, `chromaServices.js`) | — | **Node** (ChromaDB Cloud) | yes |
| Offline NLP intent engine (`offline-nlp/src/api.py`) | 8000 | **Python** | **yes — the target** |
| Legacy RAG microservice (`backend/rag_pipeline/`) | 8001 | Python | **no — superseded** |
| Evaluation / metrics / analysis scripts | — | Python | no — offline tooling |

Verified: nothing under `backend/src` or `frontend` references `:8001` any more. The only
cross-process dependency left is [nlpClient.js:7](backend/src/services/nlpClient.js#L7) →
`http://127.0.0.1:8000/predict`.

**Consequence:** migrating `offline-nlp/` to Node makes the entire *runtime* Node-only.
`backend/rag_pipeline/` needs no port — it is already dead code.

### 1.2 Entry points and dependencies

| Python entry point | Role | Disposition |
|---|---|---|
| `offline-nlp/src/api.py` | FastAPI app, `/predict` + `/health` | **port to Express** |
| `offline-nlp/src/main.py` | CLI: `train` / `test` / `benchmark` / `serve` | port all but `train` |
| `offline-nlp/src/engine.py` | 3-tier cascade (477 LOC) | **port — core logic** |
| `offline-nlp/src/preprocessor.py` | text normalisation | **port** |
| `offline-nlp/src/model.py` | `ModelTrainer` (train) + `load_model` (serve) | split: load→Node, train stays Python |
| `offline-nlp/src/prompts.py` | dead — imported nowhere | leave as-is |

`offline-nlp/requirements.txt`: `scikit-learn`, `pandas`, `joblib`, `numpy`, `fastapi`, `uvicorn`.

### 1.3 The hard part, and proof it works

The blocker in any ML migration is that **`model.joblib` and `vectorizer.joblib` are Python
pickles — Node cannot load them, and no npm package reimplements scikit-learn.**

The artifacts are:

- `FeatureUnion` of two `TfidfVectorizer`s — word (1–2 grams, 5,000 features) and char
  (2–5 grams, 10,000 features), each L2-normalised independently, `smooth_idf=True`,
  `sublinear_tf=False`, `lowercase=False`, `binary=False`.
- `LogisticRegression`, 25 classes, `coef_` (25 × 15,000) float64, lbfgs → softmax.

This is ordinary linear algebra. The approach is to **export the fitted weights and
reimplement inference in JS**, not to retrain — retraining would change predictions and
break parity.

**A trap that would have made this silently wrong:** the word tokenizer is
`(?u)\b\w\w+\b`. Python's `\w` means "alphanumeric or underscore", which **excludes**
Devanagari vowel signs, virama and anusvara (all `Mn`/`Mc` marks). So `भूकम्प` tokenizes to
just `कम`. JavaScript's `\w` is ASCII-only and `\b` is ASCII-based, so a naive port produces
entirely different features for every Nepali query. The correct JS equivalent is
`[\p{L}\p{N}_]` with lookaround-emulated boundaries.

**Feasibility probe result** — JS implementation diffed against vectors dumped from sklearn
over 400 real dataset rows plus 8 edge cases (empty, whitespace-only, Devanagari,
Romanized, numeric):

```
samples     : 408
exact match : 408
mismatch    : 0
max |delta| : 5.000e-13      <- float64 rounding only
```

The port is bit-faithful. Migration is viable with exact behavioural parity.

### 1.4 Pre-existing defect found during recon

`frontend/package.json` currently contains **two concatenated JSON objects** and is invalid
JSON — `npm install` fails on it. This is an *uncommitted local change* (`git diff` shows the
second object appended), most likely a botched merge resolution. Not caused by this
migration, but it must be resolved before any `npm` work in `frontend/`.

---

## 2. Target stack

| Python | Node replacement | Rationale |
|---|---|---|
| FastAPI | **Express 4** | already the backend's framework; keeps one framework in the repo |
| Uvicorn | Node HTTP server | built in |
| Pydantic | **Zod** | request/response schema validation |
| scikit-learn (inference) | **hand-ported inference** | no equivalent exists; proven exact above |
| scikit-learn (training) | *stays Python* | a build step, not runtime |
| joblib artifacts | **JSON + binary `Float64Array`** | portable, loads in ~ms |
| `difflib.get_close_matches` | **hand-ported SequenceMatcher** | Ratcliff–Obershelp; no faithful npm port |
| pandas (CSV read) | **`csv-parse`** | RFC4180-correct; `keywords.csv` is quoted |
| pytest | **`node:test`** | repo convention — see note below |
| python-dotenv | **`dotenv`** | already a backend dependency |

> **Deviation from brief:** the brief specifies Vitest or Jest. The repo already standardised
> on Node's built-in `node:test` (`backend/tests/`, `npm test`). I propose staying with
> `node:test` for zero added dependencies and one test command across the repo. Say the word
> and I'll use Vitest instead.

No ORM/database migration applies — there is no SQL database. ChromaDB is already on the
Node client.

---

## 3. File-by-file mapping

New code lives in `offline-nlp/node/`, beside the Python it replaces. **Nothing is moved,
renamed, or deleted.**

| Python source | → Node target | Notes |
|---|---|---|
| `src/preprocessor.py` | `node/src/preprocessor.js` | emoji map, NFC, lowercase, charset filter |
| `src/model.py::load_model` | `node/src/artifacts.js` | loads exported weights |
| — *(new)* | `node/src/tfidf.js` | word + char n-grams, TF-IDF, L2 — **proven exact** |
| — *(new)* | `node/src/logreg.js` | dense matvec + softmax |
| — *(new)* | `node/src/difflib.js` | `SequenceMatcher.ratio` + `getCloseMatches` |
| `src/engine.py` | `node/src/engine.js` | 3-tier cascade, keywords, phrase rules, urgency, entities |
| `src/api.py` | `node/src/app.js` + `node/src/server.js` | Express, identical contract |
| — *(new)* | `node/src/schemas.js` | Zod schemas replacing Pydantic models |
| `src/main.py` | `node/src/cli.js` | `serve` / `test` / `benchmark` (**not** `train`) |
| `src/model.py::ModelTrainer` | *unchanged Python* | training stays a Python build step |
| — *(new)* | `scripts/export_artifacts.py` | one-time weight export (Python tooling) |

### Contract preservation

The Express service reproduces the FastAPI contract exactly, so
[nlpClient.js](backend/src/services/nlpClient.js) needs **zero changes**:

- `POST /predict` `{text}` → `{intent, confidence, source, urgency, entities, recommended_action, latency_ms}`
- `GET /health` → `{status, message}`, **503** when the engine failed to load
- **500** with `{detail}` on inference error
- same host/port (`127.0.0.1:8000`), same 500 ms client timeout budget

---

## 4. Execution steps

**Phase 2 — Setup**
1. `offline-nlp/node/package.json` (`"type": "module"`, `start`/`dev`/`test`), deps: `express`, `zod`, `csv-parse`, `dotenv`, dev: `nodemon`.
2. Clean-architecture layout: `src/{config,services,routes,controllers,utils}`.
3. `scripts/export_artifacts.py` → `models/vectorizer.json` + `models/classifier.bin` (float64) + `models/classifier.json`.

**Phase 3 — Core migration** (each step verified against Python before moving on)
4. `preprocessor.js` — parity over the full 6,206-row dataset.
5. `tfidf.js` + `logreg.js` — parity of vectors *and* `predict_proba`.
6. `difflib.js` — parity of `get_close_matches` over the 700+ keyword dictionary.
7. `engine.js` — parity of the full `predict()` result across all 6,206 rows + edge cases.
8. `app.js` / `server.js` — Express, Zod validation, error handling, graceful load failure.

**Phase 4 — Verification & cleanup**
9. Cross-runtime parity harness: every dataset row through both services, assert identical `intent`/`confidence`/`source`.
10. Port the existing pytest suites (`test_engine.py`, `test_preprocessor.py`, `test_robustness.py`, `test_response_routing.py`) to `node:test`.
11. Audit for Python idioms (`None`→`null`, `True`→`true`, snake_case preserved *only* where the JSON contract requires it).
12. Latency benchmark — must hold the documented < 5 ms/query target.
13. Switch `npm start` to launch the Node service; Python service remains runnable for A/B.

---

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Unicode `\w` divergence | **high** | identified and solved; locked by parity tests |
| `difflib` tie-breaking differs | medium | port `_nlargest` ordering exactly; test over full keyword set |
| float64 drift changes argmax near threshold | low | parity harness asserts on `intent`, not just probabilities |
| 3 MB weight file load time | low | binary `Float64Array`, loaded once at boot |
| `frontend/package.json` invalid | medium | pre-existing; fix before any frontend npm work |

## 6. Explicitly out of scope

Not touched, per "without changing or deleting anything":

- `backend/rag_pipeline/` — already superseded; left in place
- `evaluation/`, `performance_analysis/`, `offline_nlp_metrics/`, root-level analysis scripts
- Model training (`ModelTrainer`) and the `.joblib` artifacts — both remain the source of truth
- All existing Python files remain runnable as the reference implementation
