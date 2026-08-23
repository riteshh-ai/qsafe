"""
Build a leakage-free train/validation split for the QSAFE intent dataset.

Problem this solves
-------------------
The original `split` column was assigned per-row at random. Because the corpus
was built by augmenting seed sentences (adding "???", "!!!", filler words like
"प्लिज"/"please", and deliberate typos), variants of the SAME seed sentence
ended up on both sides of the split. Measured on the shipped vectorizer, 94% of
validation rows had a training neighbour at cosine >= 0.70 and the median
validation row sat at 0.895. The resulting 99.87% validation accuracy therefore
scored memorisation of near-duplicates, not generalisation -- which is why the
same model scores ~52% on unseen real-world phrasing.

Approach
--------
Group near-duplicate rows into "seed families" (connected components over a
character n-gram cosine-similarity graph, computed within each intent), then
assign whole families to train or validation. No family is ever split, so a
validation row can never have a near-copy of itself in training.

Output keeps every original row and column; only `split` is reassigned.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse.csgraph import connected_components
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "offline-nlp"))

from src.preprocessor import TextPreprocessor  # noqa: E402

# Two rows join the same seed family at or above this cosine similarity.
# 0.80 groups punctuation/filler/typo variants while keeping genuinely
# different sentences apart (see the audit table printed by this script).
SIMILARITY_THRESHOLD = 0.80
VALIDATION_FRACTION = 0.15
RANDOM_SEED = 42


def build_families(texts: list, threshold: float = SIMILARITY_THRESHOLD) -> np.ndarray:
    """Return a family id per text via connected components on a similarity graph."""
    if len(texts) == 1:
        return np.zeros(1, dtype=int)

    # Character n-grams so typos and punctuation noise still match their seed.
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1)
    matrix = vec.fit_transform(texts)

    adjacency = cosine_similarity(matrix) >= threshold
    n_components, labels = connected_components(adjacency, directed=False)
    return labels


def assign_split(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """Assign whole seed families to train/validation, stratified per intent."""
    df = df.copy()
    df["split"] = "train"

    for intent, intent_rows in df.groupby("intent"):
        families = intent_rows["family"].unique()
        rng.shuffle(families)

        target = max(1, int(round(len(intent_rows) * VALIDATION_FRACTION)))
        held_out, count = [], 0
        for family in families:
            if count >= target:
                break
            # Never hold out every family of an intent; training needs signal.
            if len(held_out) == len(families) - 1:
                break
            held_out.append(family)
            count += int((intent_rows["family"] == family).sum())

        mask = (df["intent"] == intent) & (df["family"].isin(held_out))
        df.loc[mask, "split"] = "validation"

    return df


def main() -> int:
    source = REPO_ROOT / "offline-nlp" / "datasets" / "training_dataset.csv"
    destination = REPO_ROOT / "offline-nlp" / "datasets" / "training_dataset_grouped.csv"

    df = pd.read_csv(source, encoding="utf-8")
    preprocessor = TextPreprocessor()
    df["cleaned"] = df["text"].astype(str).map(preprocessor.clean)
    df = df[df["cleaned"].str.len() > 0].reset_index(drop=True)

    print(f"Loaded {len(df)} rows across {df['intent'].nunique()} intents")
    print(f"Grouping near-duplicates at cosine >= {SIMILARITY_THRESHOLD} ...")

    # Family ids are only comparable within an intent, so namespace them by intent.
    df["family"] = ""
    for intent, intent_rows in df.groupby("intent"):
        labels = build_families(intent_rows["cleaned"].tolist())
        df.loc[intent_rows.index, "family"] = [f"{intent}#{label}" for label in labels]

    n_families = df["family"].nunique()
    print(f"  {len(df)} rows collapse into {n_families} seed families")
    print(f"  mean family size: {len(df) / n_families:.2f}")

    largest = df["family"].value_counts().head(5)
    print("\n  Largest families (rows sharing one seed sentence):")
    for family, size in largest.items():
        example = df.loc[df["family"] == family, "text"].iloc[0]
        print(f"    {size:>3} rows  {family:<40} e.g. {example[:44]}")

    rng = np.random.default_rng(RANDOM_SEED)
    df = assign_split(df, rng)

    counts = df["split"].value_counts()
    print(f"\nSplit: {counts.get('train', 0)} train / {counts.get('validation', 0)} validation")

    missing = set(df["intent"]) - set(df.loc[df["split"] == "validation", "intent"])
    if missing:
        print(f"  WARNING: intents with no validation rows: {sorted(missing)}")

    out = df[["text", "intent", "split"]]
    out.to_csv(destination, index=False, encoding="utf-8")
    print(f"\nWrote {destination.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
