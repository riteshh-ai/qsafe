# Real-World Offline NLP Evaluation Summary

**Run date:** 2026-08-24
**Model:** `offline-nlp/models/model.joblib` + `vectorizer.joblib` (v2)
**Dataset:** `offline-nlp/datasets/training_dataset.csv` (v2, 6,206 rows)
**Held-out test set:** `evaluation/heldout_benchmark.csv` (1,103 rows, never trained on)

## Headline

| Metric | Before | After |
|---|---:|---:|
| Held-out real-world accuracy | 51.68% | **66.73%** |
| Validation accuracy (honest split) | 85.78% | **84.12%** |
| Validation accuracy (as previously reported) | 99.87% | — *see below* |
| Queries falling through to fallback | 308 / 1,103 | **168 / 1,103** |
| ML-tier accuracy | 58.2% | **72.0%** |
| Test suite | 56 passing | 56 passing |

The previous run reported 52.52% on a 2,500-query benchmark and 99.87% on the
validation split. Both numbers were untrustworthy, for different reasons. This
run replaces them with measurements that hold up.

---

## 1. The 99.87% validation accuracy was measuring memorisation

The corpus is augmentation-generated: seed sentences were multiplied by adding
punctuation (`???`, `!!!`), filler words (`प्लिज`, `please`), and deliberate
typos. The `split` column was then assigned **per row at random**, so variants
of the same seed sentence landed on both sides of the split.

Measured against the shipped vectorizer, validation rows sat this close to
their nearest training row:

| Validation rows with a training neighbour at cosine ≥ | Share |
|---|---:|
| 0.99 | 11.0% |
| 0.95 | 28.0% |
| 0.90 | 47.1% |
| 0.70 | **94.0%** |

Median similarity was 0.895. Representative pairs:

| Validation row | Nearest training row | sim |
|---|---|---:|
| `छोरी सँग सम्पर्क टुटेको छ???` | `छोरी सँग सम्पर्क टुटेको छ` | 1.000 |
| `found my father at the relief camp???` | `found my father at the relief camp` | 1.000 |
| `wall khaseko le mero aama lai thichyo` | `wall khaseko le mero aama lai thichyo!!!` | 1.000 |
| `need baby formula aand water` | `need baby formula and water` | 0.915 |

Re-splitting so that **whole seed families** stay on one side — same rows, same
architecture, only the split changes — drops the score from **99.87% to
85.78%**. That 14-point gap was leakage. `evaluation/compare_splits.py`
reproduces this.

A second consequence: the corpus's 5,149 rows collapse into only **1,819
distinct seed sentences** (mean 2.83 variants each). The effective training set
is far smaller than the row count suggests.

## 2. The dominant failure was coverage, not labels or thresholds

The previous summary proposed relabelling the benchmark and retuning the
confidence threshold. Both were measured directly, and both are minor:

| Lever | Measured gain |
|---|---:|
| Relabel contradictory benchmark entries | +0.82 pts (52.52% → 53.34%) |
| Remove the 0.25 confidence threshold entirely | +1.24 pts, and it costs the safety fallback |
| **Add real-world phrasing to training** | **+20.30 pts** |

The threshold is not holding back correct answers: of the 710 rows that fell
back, trusting the classifier's top-1 anyway would have been right only 15.1%
of the time. The model genuinely did not recognise the phrasing.

The coverage experiment (`evaluation/coverage_experiment.py`) split the
benchmark in half **by seed family**, folded one half into training, and scored
both models on the other half — which no paraphrase of the training data
touches. 45.47% → 65.77%.

## 3. What changed

`evaluation/build_training_v2.py` rebuilds the dataset. It is idempotent: it
always rebuilds from `training_dataset_v1.csv`, never from its own output.

- **Leakage-free split.** Rows are grouped into seed families by connected
  components over char-n-gram cosine similarity (≥ 0.80), and whole families
  are assigned to train or validation.
- **Real-world phrasing folded in.** Half the benchmark families (1,097 rows)
  joined training. The other half (1,103 rows) is held out permanently as
  `evaluation/heldout_benchmark.csv`.
- **102 rows withheld — contradictory gold labels.** 39 template phrases were
  listed under two different intents, making them unscoreable either way
  (`gas leak` as both `fire_incident_report` and `gas_leak_report`;
  `medical emergency` as both `emergency_contact_request` and
  `medical_emergency_request`).
- **16 rows withheld — distress mislabelled as greeting.** 26 `greeting`
  templates are pleas for rescue: `hi i need help`, `namaste malai bachau`
  ("save me"), `hi emergency here`, `hello i'm stuck`. Training on these would
  teach a disaster assistant that a distress call is a salutation. They are
  **withheld, not relabelled** — assigning gold labels to safety-critical
  intents is a team decision, not a scripted one.
- **40 rows withheld — off-topic guardrail protection.** See below.

## 4. The guardrail regression, and the trade taken

Folding in real-world phrasing initially reached 67.27% but broke the
off-topic guardrail: `what time is the match tomorrow?` started returning
`status_check_general` at 0.503 confidence.

The cause was in the data. `status_check_general` is the catch-all intent, and
it had absorbed content-free templates — `latest news`, `want to know`,
`need details`, `status update`, `tapkram` — that carry no disaster signal at
all. That turned the class into a sink for any vague question.

The fix withholds status-check rows that name nothing in the disaster/safety
domain. Cost: **0.54 points** (67.27% → 66.73%), paid to keep a safety
property. `status_check_general` sits at 40% on the held-out set as a direct
result, and that is the intended trade.

Guardrail behaviour is unchanged from before this work — 9 of 12 off-topic
probes correctly refused, both before and after. The v2 model is *less*
confident when it does leak (`how to invest in stocks`: 0.775 → 0.606).

## 5. Held-out results (1,103 rows, none seen in training)

| Source | Rows | Correct | Accuracy | Avg confidence |
|---|---:|---:|---:|---:|
| ML | 686 | 494 | 72.0% | 0.680 |
| Keyword | 238 | 208 | 87.4% | 0.983 |
| Fallback | 168 | 25 | 14.9% | 0.170 |
| Keyword fuzzy | 11 | 9 | 81.8% | 0.950 |

**Weakest intents:** `preparedness_tips_query` 26%, `status_check_general` 40%
(deliberate, see §4), `fire_incident_report` 42%, `building_collapse_report`
43%, `safe_location_query` 43%, `medical_emergency_request` 52%.

**Strongest:** `greeting` 98%, `goodbye_thanks` 95%, `sos_help_request` 95%,
`fallback_unclear` 94%.

**Top confusions:** `status_check_general` → `fallback_unclear` (23),
`building_collapse_report` → `trapped_debris_report` (14),
`safe_location_query` → `fallback_unclear` (13),
`first_aid_query` → `fallback_unclear` (13).

## 6. Open items

1. **`preparedness_tips_query` at 26%** is the weakest intent and was not
   addressed here. It needs its own phrasing pass.
2. **`building_collapse_report` → `trapped_debris_report`** (14 errors) is a
   genuine semantic overlap, not a phrasing gap. Worth deciding whether these
   should stay separate intents.
3. **Three pre-existing guardrail leaks**, unchanged by this work:
   `recommend a good movie` → `greeting`, `how to invest in stocks` →
   `first_aid_query`, `translate hello to spanish` → `greeting`.
4. **The 29 distress-mislabelled `greeting` templates still need gold labels**
   from the team. They are currently withheld from training, not fixed.
5. **Confidence threshold remains 0.25** and is still unreconciled against the
   proposal's 0.70 and `intents.md`'s tiered 0.55/0.40.

## ⚠️ Do not score v2 with `generate_real_world_queries.py`

That script's 2,500-query benchmark is **no longer a valid test set**. Half of
its seed families were folded into v2's training data, so running it now scores
the model partly on its own training set and will report an inflated number.
`evaluation/real_world_test_results.csv` and `evaluation/evaluation_report.json`
are v1 artifacts, kept only as the source of benchmark text and gold labels for
`build_training_v2.py`.

Use `evaluation/evaluate_heldout.py` against `heldout_benchmark.csv` instead —
those 1,103 rows were withheld by seed family, so no paraphrase of them appears
anywhere in training.

## Reproducing

```bash
python evaluation/build_honest_split.py     # leakage-free split, diagnostic
python evaluation/compare_splits.py         # 99.87% vs 85.78%
python evaluation/coverage_experiment.py    # +20.3 pt coverage lift
python evaluation/build_training_v2.py      # rebuild dataset (idempotent)
cd offline-nlp && python -m src.main train  # retrain
python evaluation/evaluate_heldout.py       # score on held-out benchmark
```

## Artifacts

- `offline-nlp/datasets/training_dataset.csv` — v2, 6,206 rows
- `offline-nlp/datasets/training_dataset_v1.csv` — original, preserved
- `evaluation/heldout_benchmark.csv` — 1,103 held-out rows
- `evaluation/heldout_results_v2.csv` — per-row predictions
