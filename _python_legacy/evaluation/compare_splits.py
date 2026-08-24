"""
Quantify how much of the reported validation accuracy is near-duplicate leakage.

Trains the exact shipped architecture (word 1-2gram + char 2-5gram TF-IDF union
-> LogisticRegression C=5.0) twice: once on the original random per-row split,
once on the leakage-free seed-family split from build_honest_split.py.

Writes no model artifacts -- this is measurement only, the shipped
models/*.joblib are left untouched.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import FeatureUnion

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "offline-nlp"))

from src.preprocessor import TextPreprocessor  # noqa: E402

DATASETS = REPO_ROOT / "offline-nlp" / "datasets"


def build_vectorizer() -> FeatureUnion:
    """Mirror ModelTrainer.build_vectorizer() exactly."""
    return FeatureUnion([
        ("word_tfidf", TfidfVectorizer(analyzer="word", ngram_range=(1, 2),
                                       max_features=5000, lowercase=False)),
        ("char_tfidf", TfidfVectorizer(analyzer="char", ngram_range=(2, 5),
                                       max_features=10000, lowercase=False)),
    ])


def load(path: Path, preprocessor: TextPreprocessor) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8")
    df["cleaned"] = df["text"].astype(str).map(preprocessor.clean)
    return df[df["cleaned"].str.len() > 0].reset_index(drop=True)


def evaluate(df: pd.DataFrame, label: str) -> dict:
    train = df[df["split"] == "train"]
    val = df[df["split"] == "validation"]

    vectorizer = build_vectorizer()
    X_train = vectorizer.fit_transform(train["cleaned"])
    X_val = vectorizer.transform(val["cleaned"])

    model = LogisticRegression(C=5.0, max_iter=1000, class_weight="balanced")
    model.fit(X_train, train["intent"])
    predictions = model.predict(X_val)

    # How close is each validation row to its nearest training row?
    similarity = cosine_similarity(X_val, X_train).max(axis=1)

    result = {
        "label": label,
        "train_rows": len(train),
        "val_rows": len(val),
        "accuracy": accuracy_score(val["intent"], predictions),
        "macro_f1": f1_score(val["intent"], predictions, average="macro"),
        "median_similarity": float(np.median(similarity)),
        "pct_near_dupe": float((similarity >= 0.90).mean() * 100),
    }

    # Accuracy restricted to validation rows that are NOT near-copies of training.
    novel = similarity < 0.90
    if novel.any():
        result["accuracy_on_novel"] = accuracy_score(
            val["intent"][novel], predictions[novel]
        )
        result["novel_rows"] = int(novel.sum())
    else:
        result["accuracy_on_novel"] = float("nan")
        result["novel_rows"] = 0

    return result


def main() -> int:
    preprocessor = TextPreprocessor()

    runs = [
        ("original random split", DATASETS / "training_dataset.csv"),
        ("seed-family split", DATASETS / "training_dataset_grouped.csv"),
    ]

    results = []
    for label, path in runs:
        if not path.exists():
            print(f"SKIP {label}: {path.name} not found")
            continue
        print(f"Training on {label} ...")
        results.append(evaluate(load(path, preprocessor), label))

    header = (f"{'split':<24}{'train':>7}{'val':>6}{'acc':>9}{'macroF1':>9}"
              f"{'medSim':>9}{'%dupe':>8}{'acc/novel':>11}")
    print("\n" + "=" * len(header))
    print(header)
    print("=" * len(header))
    for r in results:
        novel = "n/a" if np.isnan(r["accuracy_on_novel"]) else f"{r['accuracy_on_novel']:.2%}"
        print(f"{r['label']:<24}{r['train_rows']:>7}{r['val_rows']:>6}"
              f"{r['accuracy']:>9.2%}{r['macro_f1']:>9.2%}"
              f"{r['median_similarity']:>9.3f}{r['pct_near_dupe']:>7.1f}%{novel:>11}")
    print("=" * len(header))
    print("\nmedSim   = median cosine similarity from a validation row to its nearest training row")
    print("%dupe    = share of validation rows with a training neighbour at cosine >= 0.90")
    print("acc/novel= accuracy measured only on validation rows that are NOT near-copies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
