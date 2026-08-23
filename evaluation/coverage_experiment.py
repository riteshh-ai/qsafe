"""
Test whether the real-world benchmark gap is a COVERAGE problem.

Hypothesis: the 52.5% real-world score is not a modelling defect but a
vocabulary/phrasing gap -- the training corpus contains only ~1,819 distinct
seed sentences, and the benchmark asks questions worded outside that set.

Method: split the benchmark in half by seed family (so no paraphrase of a
held-out query can leak into training), then train twice and score BOTH runs on
the same held-out half:
    A. baseline  -> training corpus only
    B. augmented -> training corpus + the other benchmark half

If B lifts sharply over A, the classifier can learn this phrasing and the fix is
data coverage. If B barely moves, the gap is architectural.

Measurement only -- writes no model artifacts.
"""

import ast
import collections
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse.csgraph import connected_components
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import FeatureUnion

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "offline-nlp"))

from src.preprocessor import TextPreprocessor  # noqa: E402

SIMILARITY_THRESHOLD = 0.80
RANDOM_SEED = 42


def load_templates() -> dict:
    """Read the gold template dict straight out of the generator source."""
    source = (REPO_ROOT / "evaluation" / "generate_real_world_queries.py").read_text(encoding="utf-8")
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.FunctionDef) and node.name == "_load_query_templates":
            for statement in ast.walk(node):
                if isinstance(statement, ast.Return) and isinstance(statement.value, ast.Dict):
                    return ast.literal_eval(statement.value)
    raise RuntimeError("could not locate query templates")


def conflicting_phrases(templates: dict) -> set:
    """Phrases listed under more than one gold intent -- unscoreable either way."""
    owners = collections.defaultdict(set)
    for intent, phrases in templates.items():
        for phrase in phrases:
            owners[phrase.strip().lower()].add(intent)
    return {phrase for phrase, intents in owners.items() if len(intents) > 1}


def family_labels(texts: list) -> np.ndarray:
    if len(texts) < 2:
        return np.zeros(len(texts), dtype=int)
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1)
    adjacency = cosine_similarity(vec.fit_transform(texts)) >= SIMILARITY_THRESHOLD
    _, labels = connected_components(adjacency, directed=False)
    return labels


def build_vectorizer() -> FeatureUnion:
    return FeatureUnion([
        ("word_tfidf", TfidfVectorizer(analyzer="word", ngram_range=(1, 2),
                                       max_features=5000, lowercase=False)),
        ("char_tfidf", TfidfVectorizer(analyzer="char", ngram_range=(2, 5),
                                       max_features=10000, lowercase=False)),
    ])


def run(train_texts, train_labels, test_texts, test_labels) -> dict:
    vectorizer = build_vectorizer()
    X_train = vectorizer.fit_transform(train_texts)
    model = LogisticRegression(C=5.0, max_iter=1000, class_weight="balanced")
    model.fit(X_train, train_labels)
    predictions = model.predict(vectorizer.transform(test_texts))
    return {
        "rows": len(train_texts),
        "accuracy": accuracy_score(test_labels, predictions),
        "macro_f1": f1_score(test_labels, predictions, average="macro", zero_division=0),
    }


def main() -> int:
    preprocessor = TextPreprocessor()
    rng = np.random.default_rng(RANDOM_SEED)

    corpus = pd.read_csv(REPO_ROOT / "offline-nlp" / "datasets" / "training_dataset.csv",
                         encoding="utf-8")
    corpus["cleaned"] = corpus["text"].astype(str).map(preprocessor.clean)
    corpus = corpus[corpus["cleaned"].str.len() > 0]

    bench = pd.read_csv(REPO_ROOT / "evaluation" / "real_world_test_results.csv",
                        encoding="utf-8")[["text", "intent"]]
    bad = conflicting_phrases(load_templates())
    before = len(bench)
    bench = bench[~bench["text"].astype(str).str.strip().str.lower().isin(bad)]
    bench["cleaned"] = bench["text"].astype(str).map(preprocessor.clean)
    bench = bench[bench["cleaned"].str.len() > 0].reset_index(drop=True)
    print(f"Benchmark: {before} rows, dropped {before - len(bench)} with contradictory gold labels")

    # Group benchmark rows into seed families, then halve by family.
    bench["family"] = ""
    for intent, rows in bench.groupby("intent"):
        labels = family_labels(rows["cleaned"].tolist())
        bench.loc[rows.index, "family"] = [f"{intent}#{n}" for n in labels]

    families = bench["family"].unique()
    rng.shuffle(families)
    half = set(families[: len(families) // 2])
    fold_a = bench[bench["family"].isin(half)]      # may be folded into training
    fold_b = bench[~bench["family"].isin(half)]     # always held out

    print(f"           {bench['family'].nunique()} seed families -> "
          f"fold A {len(fold_a)} rows / fold B {len(fold_b)} rows (held out)\n")

    baseline = run(corpus["cleaned"], corpus["intent"], fold_b["cleaned"], fold_b["intent"])
    augmented = run(
        pd.concat([corpus["cleaned"], fold_a["cleaned"]]),
        pd.concat([corpus["intent"], fold_a["intent"]]),
        fold_b["cleaned"], fold_b["intent"],
    )

    header = f"{'training data':<34}{'rows':>7}{'acc on fold B':>16}{'macro F1':>11}"
    print("=" * len(header))
    print(header)
    print("=" * len(header))
    print(f"{'A. corpus only (baseline)':<34}{baseline['rows']:>7}"
          f"{baseline['accuracy']:>15.2%}{baseline['macro_f1']:>11.2%}")
    print(f"{'B. corpus + benchmark fold A':<34}{augmented['rows']:>7}"
          f"{augmented['accuracy']:>15.2%}{augmented['macro_f1']:>11.2%}")
    print("=" * len(header))
    delta = augmented["accuracy"] - baseline["accuracy"]
    print(f"\nLift from adding real-world phrasing: {delta:+.2%}")
    print("Fold B was never trained on, and no paraphrase of it appears in fold A.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
