# `_python_legacy/` — archived Python implementation

Everything here was replaced by the Node.js migration on the `node` branch. Nothing in this
directory runs as part of QSAFE any more, and nothing in the live codebase imports from it.
It is kept for provenance: it is the reference implementation the Node port was verified
against, and the source of the model weights the service loads today.

**No Python is required to build, test, run or retrain QSAFE.**

## What replaced what

| Archived | Replaced by |
|---|---|
| `offline-nlp/src/api.py` (FastAPI, :8000) | `offline-nlp/node/src/app.js` + `server.js` (Express, :8000) |
| `offline-nlp/src/engine.py` | `offline-nlp/node/src/services/engine.js` |
| `offline-nlp/src/preprocessor.py` | `offline-nlp/node/src/utils/preprocessor.js` |
| `offline-nlp/src/model.py` (`ModelTrainer`) | `offline-nlp/node/scripts/train.js` + `src/training/` |
| `offline-nlp/src/model.py` (`load_model`) | `offline-nlp/node/src/services/artifacts.js` |
| `offline-nlp/src/main.py` (CLI) | `offline-nlp/node/src/cli.js` |
| `offline-nlp/tests/*.py` (pytest) | `offline-nlp/node/tests/*.test.js` (`node:test`) |
| `offline-nlp/models/*.joblib` | `offline-nlp/node/artifacts/` (JSON + float64 binary) |
| `backend/rag_pipeline/*.py` (:8001) | `backend/src/config/chroma.js` (ChromaDB Cloud) — superseded upstream, before this migration |
| `offline-nlp/src/prompts.py` | nothing; it was dead code, imported nowhere |

`evaluation/`, `performance_analysis/`, `offline_nlp_metrics/` and the root-level analysis
scripts were **not** ported. They are offline reporting tools that generate charts and
metrics; they were never in the request path. If you need one of those reports again, that
is a separate porting job — say so and it can be done.

## The bridge scripts

`offline-nlp/scripts/export_artifacts.py` and `dump_golden.py` are the two scripts that made
the migration verifiable. They ran **once**, before archiving:

- `export_artifacts.py` lifted the fitted scikit-learn weights out of the `.joblib` pickles
  into `offline-nlp/node/artifacts/` (JSON vocabularies + a little-endian float64
  `weights.bin`). This is why the Node service reproduces the original model exactly rather
  than approximating it.
- `dump_golden.py` froze the Python engine's predictions over all 6,206 dataset rows plus
  adversarial edge cases into `offline-nlp/node/tests/fixtures/python-golden.json`. That
  fixture is the contract `offline-nlp/node/tests/parity.test.js` still asserts against, and
  it is now the only surviving record of the reference behaviour.

You should not need to run either again. They are kept so the provenance of
`node/artifacts/` is auditable, and so the export can be repeated if the original `.joblib`
files ever need to be re-read.

## Verification results at the time of archiving

- **Inference parity: exact.** 6,234/6,234 records matched the Python engine on intent,
  confidence, source, urgency, entities and recommended action, across all four tiers
  (`keyword`, `keyword_fuzzy`, `ml`, `fallback`) and all three scripts.
- **TF-IDF: bit-faithful.** 408/408 feature vectors matched, max delta 5e-13.
- **difflib: bit-faithful.** 36,960 `ratio()` comparisons, 0 mismatches, max delta 5e-16;
  308/308 `get_close_matches` results identical.
- **Training: equivalent, not identical.** A different L-BFGS implementation follows a
  different trajectory, so retrained weights differ from scikit-learn's. On the same 844-row
  validation split: scikit-learn 84.12% accuracy / 83.21% macro-F1, Node 83.53% / 82.71%.

## If you ever need to run this again

These files were written against Python 3.14 with `scikit-learn>=1.9`, `pandas>=3.0.5`,
`joblib`, `numpy`, `fastapi` and `uvicorn` (see `offline-nlp/requirements.txt`). Paths inside
them are relative to the original repository layout, so they will need their paths adjusted,
or the directory copied back to the repo root, before they will import cleanly.
