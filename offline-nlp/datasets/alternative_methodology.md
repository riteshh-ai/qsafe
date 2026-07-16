# QSAFE Nepal — Alternative NLP Methodology Comparison

## Context

The QSAFE Nepal NLU layer must run **fully offline** on modest hardware (a village-level
deployment target implied by the "offline-first" project brief), classify **short, noisy,
code-mixed** utterances (English / Nepali Unicode / Roman Nepali) into ~25 intents, and do
so with enough reliability that emergency-tier intents are not missed. This document
compares candidate approaches against that specific constraint set — not against a
general-purpose leaderboard.

## Comparison Table

| Framework | Accuracy (on small multilingual intent sets) | Offline Capability | Memory Usage | Training Difficulty | Inference Speed (CPU, low-end device) | Deployment Complexity | Multilingual Support |
|---|---|---|---|---|---|---|---|
| **NLP.js** | Good (85–92% typical on ~20-30 balanced intents with 30-60 examples/intent) | Excellent — designed for fully offline, embedded Node.js use | Very low (a few MB for the trained model) | Low — built-in NER, tokenizers, stemmers per language; minimal ML expertise needed | Very fast (<10ms typical) | Very low — single npm package, no GPU, no external services | Good — built-in language plugins; Nepali needs a custom tokenizer/stemmer addition, still lightweight |
| **FastText** | Good (80-90% with enough labeled data; strong on short text) | Excellent — C++ core, tiny binary models, no internet needed | Low (model files typically 1-50MB depending on vocab size) | Low-Medium — simple to train, but hyperparameter tuning (n-grams, dims) helps | Extremely fast | Low — single binary + model file | Moderate — needs per-language pretrained vectors or trains its own; code-mixed text needs custom preprocessing |
| **spaCy** (text classification component) | Good (comparable to FastText/NLP.js on small datasets) | Good — runs offline once models are downloaded/bundled | Medium (base pipelines ~40-500MB depending on model) | Medium — more configuration (pipelines, components) than NLP.js | Fast (tens of ms) | Medium — heavier dependency footprint than NLP.js | Moderate — no official Nepali model; would require training a blank pipeline from scratch |
| **Sentence Transformers** (e.g. multilingual MiniLM + classifier head) | Very good (90%+ achievable given embedding quality) | Possible offline once weights are bundled, but weights are large | High (100-500MB+ per model) | Medium — need to fine-tune or at least calibrate a classifier head on embeddings | Moderate (100ms+ on CPU, slower without a GPU) | Medium-High — requires PyTorch/ONNX runtime bundled offline | Excellent — strong multilingual + code-mixed embeddings out of the box |
| **TensorFlow Lite** (custom small classifier) | Good, dependent entirely on custom architecture and training data quality | Excellent — purpose-built for offline/embedded/mobile inference | Very low once quantized (can be <5MB) | High — requires designing, training, and quantizing a model from scratch | Very fast once converted | Medium — conversion/quantization pipeline adds engineering overhead | Depends entirely on custom embeddings chosen; no built-in multilingual support |
| **Naive Bayes** (bag-of-words / TF-IDF) | Moderate (70-85%, degrades with code-mixing and typos) | Excellent — trivially offline, tiny footprint | Extremely low | Very low — fast to train, simple math | Extremely fast | Very low | Poor by itself — needs separate vocabularies per language, no shared representation |
| **SVM** (TF-IDF features) | Moderate-Good (75-88%) | Excellent — offline, small model | Low | Low-Medium — needs feature engineering (n-grams, TF-IDF tuning) | Fast | Low | Poor-Moderate — same per-language vocabulary limitation as Naive Bayes |
| **Rasa** (NLU pipeline) | Good (similar to spaCy/FastText backends, since Rasa wraps them) | Good — runs offline once configured, but heavier runtime | Medium-High (full Rasa server + dependencies) | Medium-High — more moving parts (pipeline YAML, actions server) than needed for pure intent classification | Fast once loaded, but slower cold-start | High — full conversational-AI framework is overkill for intent-only classification | Good — supports custom pipelines per language, but again needs Nepali-specific tuning |
| **DistilBERT** (fine-tuned multilingual variant) | Very good (90%+ with enough data) | Possible offline, but heavy for embedded/low-resource targets | High (250MB+ typical) | High — needs GPU-accelerated fine-tuning, careful data splits | Slow on CPU-only, low-end hardware (100-300ms+) | High — needs a transformers runtime bundled | Good if using a genuinely multilingual checkpoint |
| **mBERT** (multilingual BERT) | Very good (90%+) | Possible offline but very heavy | Very high (400-700MB) | High | Slow on CPU | High | Excellent — 100+ languages including Nepali |
| **XLM-R** | Excellent (often best-in-class for cross-lingual intent tasks) | Possible offline but heaviest of the transformer options | Very high (500MB-1GB+) | High — significant compute for fine-tuning | Slow on CPU-only hardware | Very high | Excellent — state-of-the-art cross-lingual transfer, strong for code-mixed text |
| **Rule-Based** (regex/keyword matching) | Poor-Moderate on paraphrase variety (misses reworded intents entirely) | Excellent — no model at all | Negligible | Low to write, but brittle and needs constant manual rule expansion | Instant | Very low | Poor — every language/spelling variant needs its own explicit rule |

## Why NLP.js is the right choice for this project

1. **Offline-first is non-negotiable, and NLP.js was purpose-built for exactly this.** It
   runs entirely inside a Node.js process with no external API calls, no GPU, and a model
   footprint measured in single-digit megabytes — appropriate for a village-deployable
   assistant where the transformer-based options (DistilBERT/mBERT/XLM-R/Sentence
   Transformers) would be far too heavy to bundle and run acceptably on low-end hardware.

2. **The dataset scale matches NLP.js's sweet spot.** With ~25 intents and 30-85 examples
   per intent per language (this dataset's actual achieved counts), NLP.js's built-in
   Bayes/logistic-regression-style classifier with stemming and NER support performs
   reliably — whereas transformer fine-tuning generally wants thousands of examples per
   class to justify its added complexity and compute cost, which isn't available or
   necessary here.

3. **Undergraduate-project engineering budget.** NLP.js needs no custom training loop, no
   GPU access, and integrates directly with a Node.js chatbot backend in a few lines of
   code — appropriate for a Computer Engineering minor project timeline, compared to
   spaCy's blank-pipeline-from-scratch requirement for Nepali, or Rasa's heavier
   multi-component conversational framework which solves a broader problem than "classify
   this short utterance."

4. **Code-mixed short text doesn't need deep contextual embeddings to classify well here.**
   Because QSAFE Nepal's intents are lexically distinguishable (specific keywords like
   "ambulance"/"एम्बुलेन्स"/"bhukampa" strongly signal intent), a lighter statistical
   classifier with keyword/stem matching (NLP.js's approach) captures most of the signal
   that a heavyweight contextual embedding model would — at a tiny fraction of the
   resource cost.

5. **Trade-off acknowledged.** NLP.js will likely underperform XLM-R or Sentence
   Transformers on deeply paraphrased or highly ambiguous inputs, since it lacks true
   contextual embeddings. For this project's emergency-classification use case, that gap
   is mitigated by (a) the lower confidence threshold set on emergency-tier intents in
   `intents.md`, which reduces false negatives on garbled input, and (b) routing
   low-confidence cases to `fallback_unclear` or a clarifying question rather than
   guessing — an acceptable trade-off given the hard offline/low-resource constraint.

## Recommended fallback path if NLP.js accuracy proves insufficient in testing

If evaluation on held-out `training_dataset.csv` (validation split) shows unacceptable
accuracy on the Mixed-language file specifically (the hardest case), a reasonable
escalation path — without abandoning the offline constraint — is:
FastText with custom-trained embeddings on this project's own labelled data (still tiny
and offline-friendly), before considering the much heavier transformer options.
