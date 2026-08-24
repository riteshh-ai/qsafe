# QSAFE Offline NLP Microservice (Node.js)

Offline bilingual intent classification for Nepal disaster response. Classifies English,
Devanagari Nepali and Romanized Nepali queries into 25 intents, entirely on-device with no
network calls and no Python.

Replaces the previous FastAPI/scikit-learn service, reproducing its predictions **exactly** —
see [Parity](#parity) below.

## Quick start

```bash
npm install
npm start           # http://127.0.0.1:8000
npm test            # 64 tests, no services required
```

## API

Identical to the FastAPI service it replaced, so `backend/src/services/nlpClient.js` needed
no changes.

### `POST /predict`

```jsonc
// request
{ "text": "I am trapped under debris" }

// 200
{
  "intent": "trapped_debris_report",
  "confidence": 0.98,
  "source": "keyword",              // keyword | keyword_fuzzy | ml | fallback
  "urgency": "HIGH",                // HIGH | LOW
  "entities": { "headcount": "3", "location": "kathmandu" },
  "recommended_action": "show_ambulance_button",
  "latency_ms": 0.42
}
```

Field names are snake_case deliberately: they are the wire contract the backend reads, not
internal JS style.

| Status | Body | When |
|---|---|---|
| 200 | `QueryResponse` | success |
| 422 | `{detail: [{loc, msg, type}]}` | invalid body (FastAPI's shape) |
| 500 | `{detail: string}` | inference error |
| 503 | `{detail: string}` | engine failed to load |
| 413 | `{detail: string}` | body over the size cap |

### `GET /health`

`200 {status, message}`, or `503` when the engine did not load. A load failure keeps the
service listening so the failure is legible to the caller rather than a dead socket.

### `GET /`

Service metadata: version, runtime, whether the engine loaded.

## How classification works

Five tiers, evaluated in order. The first to fire wins — an exact keyword hit is never
overridden by the classifier.

| Tier | Mechanism | Confidence | `source` |
|---|---|---|---|
| 1a | exact keyword (`datasets/keywords.csv`) | 1.00 | `keyword` |
| 1b | ordered high-signal phrase rules | 0.98 | `keyword` |
| 1c | fuzzy keyword, difflib cutoff 0.85 | 0.95 | `keyword_fuzzy` |
| 2 | hybrid TF-IDF + multinomial logistic regression | model | `ml` |
| 3 | threshold guard, τ = 0.25 | model | `fallback` |

Tier 3 is what stops a weak signal becoming a confident wrong answer: below τ the argmax is
discarded and the result is `fallback_unclear`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NLP_HOST` | `127.0.0.1` | bind address |
| `NLP_PORT` | `8000` | bind port |
| `NLP_BODY_LIMIT` | `64kb` | max request body |
| `NLP_LOG_REQUESTS` | `true` | per-request logging |

## CLI

```bash
node src/cli.js test                        # classify sample queries, show tiers
node src/cli.js benchmark --iterations 1000 # latency percentiles
node src/cli.js serve                       # same as npm start
node scripts/train.js                       # retrain from datasets/training_dataset.csv
```

## Performance

Measured on the benchmark corpus (2,000 queries, after warm-up):

| | |
|---|---|
| mean | 0.64 ms |
| p50 | 0.89 ms |
| p95 | 1.39 ms |
| p99 | 1.84 ms |
| cold start | ~100 ms (loads a 3 MB weight blob once) |

The backend aborts NLP calls at 500 ms, so there is roughly two orders of magnitude of
headroom.

## Parity

The port was verified against the scikit-learn reference before it was archived:

- **6,234/6,234** predictions identical on intent, confidence, source, urgency, entities and
  recommended action — the full training dataset plus adversarial edge cases, covering all
  four tiers and all three scripts.
- **408/408** TF-IDF feature vectors identical, max delta 5e-13.
- **36,960** difflib `ratio()` comparisons, 0 mismatches, max delta 5e-16.

`tests/parity.test.js` asserts this permanently against
`tests/fixtures/python-golden.json`. **A failure there means the port has drifted — do not
fix it by regenerating the fixture.**

Two subtleties that a naive port gets silently wrong, both locked by tests:

- **Python's `\w` excludes Devanagari marks.** Vowel signs, virama and anusvara are `Mn`/`Mc`
  and are *not* word characters in Python, so `भूकम्प` tokenizes to `कम`. JavaScript's `\w`
  is ASCII-only and `\b` is ASCII-based; both are emulated with `[\p{L}\p{N}_]` and
  lookaround.
- **Python's `\s` excludes U+FEFF.** JavaScript's includes it, so a BOM would survive as a
  space instead of being deleted.

## Retraining

```bash
node scripts/train.js [--dataset PATH] [--out DIR] [--C 5.0] [--max-iter 1000]
```

Training is the one part that is **not** bit-faithful: a different L-BFGS implementation
takes a different path to the optimum. The objective, penalty and hyperparameters match
scikit-learn's, and quality is equivalent — on the same 844-row validation split,
scikit-learn scored 84.12% accuracy / 83.21% macro-F1 and this trainer 83.53% / 82.71%.

Retraining invalidates `tests/fixtures/python-golden.json`, which describes the *original*
model. Regenerate it deliberately and review the diff.

## Layout

```
src/
  config/       environment configuration
  controllers/  request handlers
  routes/       route table
  schemas/      Zod request/response schemas (replaced Pydantic)
  services/
    engine.js         tier cascade
    tfidf.js          TF-IDF inference    (bit-faithful to sklearn)
    logreg.js         softmax inference   (bit-faithful to sklearn)
    artifacts.js      weight loading
    phraseRules.js    ordered phrase rules - ORDER IS SEMANTIC
    engineRegistry.js engine lifecycle
  training/
    tfidfFit.js       vocabulary + idf fitting
    logregTrain.js    multinomial loss + gradient
    lbfgs.js          L-BFGS with strong-Wolfe line search
  utils/
    preprocessor.js   normalisation (bit-faithful to sklearn)
    difflib.js        SequenceMatcher port (bit-faithful to CPython)
artifacts/      exported model weights (JSON + float64 binary)
tests/          64 tests incl. the parity fixture
```
