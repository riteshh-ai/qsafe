"""Freeze the Python engine's behaviour as a golden fixture for the Node port.

The Node service must reproduce the Python classifier exactly. Once the Python tree is
archived that reference is gone, so its output is captured here as a checked-in fixture
that `offline-nlp/node/tests/parity.test.js` asserts against forever.

Covers every row of the training dataset plus hand-picked adversarial inputs that exercise
each tier and each script.

    .venv/Scripts/python offline-nlp/scripts/dump_golden.py
"""
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.engine import IntentEngine  # noqa: E402

OUT = ROOT / "node" / "tests" / "fixtures" / "python-golden.json"

# Adversarial inputs: tier boundaries, scripts, casing, punctuation, degenerate input.
EDGE_CASES = [
    "", "   ", "\t\n", "a", "hi", "hello", "namaste", "नमस्ते",
    "emergency kit", "first aid", "bhuikampa", "भूकम्प", "earthquake",
    "earthquke",                      # fuzzy tier
    "what's happening in my area",    # phrase tier
    "HELP ME NOW",                    # isupper -> HIGH urgency
    "help!",                          # punctuation -> HIGH urgency
    "3 people trapped in kathmandu",  # entity extraction
    "५ जना घाइते छन् पोखरामा",        # Devanagari digits + location
    "🚨 fire 🔥 help",                 # emoji mapping
    "xyzabc 123 random",              # low confidence -> fallback
    "python programming",
    "छत खसेर दिदी थुनिनुभयो",
    "gaun jana akidaina road band cha",
    "x" * 250,                        # difflib autojunk path
    "  MIXED case  With   Spaces  ",
    "123 456",
    "भूकम्प आयो, के गर्ने?",
]

FIELDS = ("intent", "confidence", "source", "urgency", "entities", "recommended_action")


def main() -> int:
    engine = IntentEngine(ROOT)

    df = pd.read_csv(ROOT / "datasets" / "training_dataset.csv", encoding="utf-8")
    inputs = df["text"].astype(str).tolist() + EDGE_CASES

    records = []
    for text in inputs:
        result = engine.predict(text)
        records.append({"input": text, **{k: result[k] for k in FIELDS}})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "generator": "offline-nlp/scripts/dump_golden.py",
                "engine": "python/scikit-learn (reference implementation)",
                "confidenceThreshold": IntentEngine.CONFIDENCE_THRESHOLD,
                "fields": list(FIELDS),
                "count": len(records),
                "records": records,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    by_source = {}
    for r in records:
        by_source[r["source"]] = by_source.get(r["source"], 0) + 1
    print(f"records : {len(records)}")
    print(f"by tier : {by_source}")
    print(f"written : {OUT}  ({OUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
