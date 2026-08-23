# Real-World Offline NLP Evaluation Summary

**Run date:** 2026-08-21  
**Script:** `evaluation/generate_real_world_queries.py`  
**Model:** `offline-nlp/models/model.joblib` + `offline-nlp/models/vectorizer.joblib`  
**Dataset:** 2,500 generated real-world queries, 100 per intent across 25 intents

## Result

The real-world generated-query benchmark is much harder than the held-out validation split.

| Metric | Value |
|---|---:|
| Total samples | 2,500 |
| Correct predictions | 1,042 |
| Errors | 1,458 |
| Overall accuracy | 41.68% |

## Inference Source Breakdown

| Source | Samples | Correct | Accuracy | Average confidence |
|---|---:|---:|---:|---:|
| ML | 1,430 | 857 | 59.93% | 0.6285 |
| Fallback | 945 | 77 | 8.15% | 0.1481 |
| Keyword | 89 | 79 | 88.76% | 1.0000 |
| Keyword fuzzy | 36 | 29 | 80.56% | 0.9500 |

The dominant failure mode is low-confidence fallback: 945 / 2,500 generated queries fell below the current 0.25 model confidence threshold.

## Best Performing Intents

| Intent | Accuracy | Errors |
|---|---:|---:|
| `fallback_unclear` | 90% | 10 |
| `greeting` | 90% | 10 |
| `earthquake_occurring_report` | 89% | 11 |
| `goodbye_thanks` | 86% | 14 |
| `sos_help_request` | 84% | 16 |

## Worst Performing Intents

| Intent | Accuracy | Errors | Most common prediction |
|---|---:|---:|---|
| `status_check_general` | 4% | 96 | `fallback_unclear` |
| `building_damage_check` | 13% | 87 | `fallback_unclear` |
| `first_aid_query` | 18% | 82 | `fallback_unclear` |
| `family_member_missing` | 18% | 82 | `fallback_unclear` |
| `preparedness_tips_query` | 22% | 78 | `fallback_unclear` |
| `emergency_contact_request` | 22% | 78 | `fallback_unclear` |
| `evacuation_guidance_query` | 24% | 76 | `fallback_unclear` |
| `building_collapse_report` | 26% | 74 | `fallback_unclear` |
| `power_outage_report` | 27% | 73 | `fallback_unclear` |
| `road_blockage_report` | 28% | 72 | `fallback_unclear` |

## Top Error Patterns

| True intent | Predicted intent | Count |
|---|---|---:|
| `status_check_general` | `fallback_unclear` | 68 |
| `first_aid_query` | `fallback_unclear` | 60 |
| `building_damage_check` | `fallback_unclear` | 59 |
| `building_collapse_report` | `fallback_unclear` | 55 |
| `injury_report` | `fallback_unclear` | 53 |
| `power_outage_report` | `fallback_unclear` | 52 |
| `family_member_missing` | `fallback_unclear` | 51 |
| `road_blockage_report` | `fallback_unclear` | 50 |
| `family_reunification_status` | `fallback_unclear` | 49 |
| `emergency_contact_request` | `fallback_unclear` | 47 |
| `aftershock_information_query` | `earthquake_occurring_report` | 43 |
| `fire_incident_report` | `gas_leak_report` | 22 |

## Interpretation

The model still performs extremely well on the original validation split, but this generated benchmark exposes a generalization gap. The issue is not only the classifier: many generated phrases are outside the current training distribution, and the benchmark includes several neighboring or ambiguous labels.

Examples of likely benchmark-label ambiguity:

- `another earthquake` is labeled `earthquake_occurring_report`, but can reasonably map to `aftershock_information_query`.
- `gas leak` and `smell gas` appear under `fire_incident_report`, but the system has a separate `gas_leak_report` intent.
- `medical emergency` is labeled `emergency_contact_request`, but sounds like an active `medical_emergency_request`.
- `fire brigade` is labeled `emergency_contact_request`, but keyword rules route it to `fire_incident_report`.

That means the 41.68% score should be treated as a stress-test signal, not as a direct production accuracy estimate.

## Recommended Next Steps

1. Clean and relabel the generated benchmark templates so each phrase has one defensible gold intent.
2. Add real-world paraphrases from the benchmark to the training data for the weakest intents.
3. Add high-recall keyword/phrase rules for low-performing but operationally important intents, especially `building_damage_check`, `family_member_missing`, `first_aid_query`, `emergency_contact_request`, and `road_blockage_report`.
4. Revisit intent-specific thresholds. A single global 0.25 threshold still sends many disaster-related queries to fallback.
5. Rerun this evaluation after dataset cleanup and model retraining, then compare against `evaluation/evaluation_report.json`.

## Generated Artifacts

- `evaluation/real_world_queries.csv`
- `evaluation/real_world_test_results.csv`
- `evaluation/evaluation_report.json`
