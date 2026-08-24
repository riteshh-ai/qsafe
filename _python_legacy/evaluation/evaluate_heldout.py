"""
Score the full IntentEngine against the held-out real-world benchmark.

Unlike generate_real_world_queries.py, every row here is guaranteed absent from
training: heldout_benchmark.csv is the fold that build_training_v2.py withheld,
split by seed family so no paraphrase of these rows was trained on either.

This runs the complete tiered pipeline (exact keyword -> phrase rules -> fuzzy
-> ML -> fallback), not just the classifier, so the number reflects what the
service actually answers with.

Usage:
    python evaluation/evaluate_heldout.py [--csv OUT] [--label NAME]
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "offline-nlp"))

from src.engine import IntentEngine  # noqa: E402

EVALUATION = REPO_ROOT / "evaluation"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", help="write per-row predictions here")
    parser.add_argument("--label", default="current", help="name for this run")
    args = parser.parse_args()

    bench = pd.read_csv(EVALUATION / "heldout_benchmark.csv", encoding="utf-8")
    engine = IntentEngine(REPO_ROOT / "offline-nlp")

    rows = []
    for text, gold in zip(bench["text"], bench["intent"]):
        result = engine.predict(str(text))
        rows.append({
            "text": text,
            "intent": gold,
            "predicted_intent": result["intent"],
            "confidence": result["confidence"],
            "source": result["source"],
            "is_correct": result["intent"] == gold,
        })

    df = pd.DataFrame(rows)
    correct, total = int(df["is_correct"].sum()), len(df)

    print(f"\n{'=' * 62}")
    print(f"HELD-OUT BENCHMARK  --  {args.label}")
    print(f"{'=' * 62}")
    print(f"  rows      : {total}  (none seen in training)")
    print(f"  correct   : {correct}")
    print(f"  ACCURACY  : {correct / total:.2%}")

    print(f"\n  {'source':<16}{'n':>6}{'correct':>9}{'accuracy':>10}{'avg conf':>10}")
    print(f"  {'-' * 51}")
    for source, group in sorted(df.groupby("source"), key=lambda kv: -len(kv[1])):
        print(f"  {source:<16}{len(group):>6}{int(group['is_correct'].sum()):>9}"
              f"{group['is_correct'].mean():>10.1%}{group['confidence'].mean():>10.3f}")

    per_intent = (df.groupby("intent")["is_correct"]
                  .agg(["mean", "count"])
                  .sort_values("mean"))
    print(f"\n  Weakest intents:")
    for intent, row in per_intent.head(6).iterrows():
        print(f"    {intent:<34}{row['mean']:>7.0%}  ({int(row['count'])} rows)")
    print(f"\n  Strongest intents:")
    for intent, row in per_intent.tail(4).iloc[::-1].iterrows():
        print(f"    {intent:<34}{row['mean']:>7.0%}  ({int(row['count'])} rows)")

    errors = df[~df["is_correct"]]
    if len(errors):
        print(f"\n  Top confusions:")
        pairs = Counter(zip(errors["intent"], errors["predicted_intent"]))
        for (gold, predicted), count in pairs.most_common(6):
            print(f"    {gold:<30} -> {predicted:<28}{count:>4}")

    if args.csv:
        df.to_csv(args.csv, index=False, encoding="utf-8")
        print(f"\n  wrote {args.csv}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
