"""
Build training_dataset v2: the coverage fix, with an honest held-out test set.

Why
---
Three measured facts drive this script:

1. The v1 `split` column was assigned per row at random, but the corpus is
   augmentation-generated. 94% of validation rows had a training neighbour at
   cosine >= 0.70, so the reported 99.87% scored memorisation. Grouping rows
   into seed families and splitting by family gives 85.78% -- the honest number.

2. The corpus rows (5,149) collapse into only ~1,819 distinct seed sentences.
   Real-world phrasing outside that set falls through to the 0.25-confidence
   fallback (710 of 2,500 benchmark rows, 10.7% correct).

3. Folding real-world phrasing into training lifts a strictly held-out
   benchmark fold by +20.3 points -- far more than relabelling (+0.8) or
   dropping the confidence threshold (+1.2). Coverage is the lever.

Outputs
-------
offline-nlp/datasets/training_dataset.csv     v2 corpus, leakage-free split
offline-nlp/datasets/training_dataset_v1.csv  untouched original, for comparison
evaluation/heldout_benchmark.csv              never trained on; honest test set

Excluded from training, deliberately:
  * 39 template phrases carrying two different gold intents (unscoreable).
  * `greeting` templates that are actually distress calls, e.g. "namaste malai
    bachau" ("save me"). These are NOT relabelled here -- inventing gold labels
    for safety-critical intents is a team decision, so they are simply withheld.
"""

import ast
import collections
import re
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

DATASETS = REPO_ROOT / "offline-nlp" / "datasets"
EVALUATION = REPO_ROOT / "evaluation"

SIMILARITY_THRESHOLD = 0.80
VALIDATION_FRACTION = 0.15
HELDOUT_FRACTION = 0.50
RANDOM_SEED = 42

# A "greeting" containing one of these is a distress call, not a salutation.
DISTRESS = re.compile(
    r"\b(help|emergency|urgent|stuck|trapped|save|rescue|bachau|injured|"
    r"bleeding|collapse|fire|danger|sos)\b"
)

# `status_check_general` is the catch-all intent, so it is the one class that
# can quietly swallow off-topic questions. Folding in content-free templates
# ("latest news", "want to know", "status update") did exactly that: it started
# answering "what time is the match tomorrow?" as a disaster status query,
# breaking the off-topic guardrail. A status query is only kept for training if
# it names something in the disaster/safety domain.
DOMAIN_ANCHOR = re.compile(
    r"(disaster|earthquake|quake|tremor|aftershock|bhukampa|parakampan|"
    r"emergency|aapat|aapad|safe|safety|surakshit|suraksha|danger|khatara|"
    r"rescue|relief|uddhar|damage|kshati|hazard|evacuat|shelter|casualt|"
    r"injur|victim|crisis|sankat|risk|jokhim|"
    r"भूकम्प|पराकम्पन|आपत|सुरक्ष|खतर|उद्धार|राहत|क्षति|संकट|जोखिम)"
)


def load_templates() -> dict:
    source = (EVALUATION / "generate_real_world_queries.py").read_text(encoding="utf-8")
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


def assign_families(df: pd.DataFrame) -> pd.DataFrame:
    """Namespace connected-component ids by intent; families never cross intents."""
    df = df.copy()
    df["family"] = ""
    for intent, rows in df.groupby("intent"):
        texts = rows["cleaned"].tolist()
        if len(texts) < 2:
            labels = np.zeros(len(texts), dtype=int)
        else:
            vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1)
            adjacency = cosine_similarity(vec.fit_transform(texts)) >= SIMILARITY_THRESHOLD
            _, labels = connected_components(adjacency, directed=False)
        df.loc[rows.index, "family"] = [f"{intent}#{n}" for n in labels]
    return df


def split_by_family(df: pd.DataFrame, fraction: float, rng) -> pd.Series:
    """Select whole families per intent until `fraction` of that intent is reached."""
    selected = pd.Series(False, index=df.index)
    for intent, rows in df.groupby("intent"):
        families = np.array(rows["family"].unique(), dtype=object)
        rng.shuffle(families)
        target, taken, count = max(1, int(round(len(rows) * fraction))), [], 0
        for family in families:
            # Never take every family of an intent; the other side needs rows too.
            if count >= target or len(taken) == len(families) - 1:
                break
            taken.append(family)
            count += int((rows["family"] == family).sum())
        selected.loc[rows.index[rows["family"].isin(taken)]] = True
    return selected


def main() -> int:
    preprocessor = TextPreprocessor()
    rng = np.random.default_rng(RANDOM_SEED)

    # ---- 1. corpus, with a leakage-free split -------------------------------
    # Always rebuild from v1, never from a previous run's output, so re-running
    # this script is idempotent instead of compounding folded-in rows.
    pristine = DATASETS / "training_dataset_v1.csv"
    if not pristine.exists():
        pd.read_csv(DATASETS / "training_dataset.csv", encoding="utf-8").to_csv(
            pristine, index=False, encoding="utf-8")
        print("Preserved original as training_dataset_v1.csv")
    corpus = pd.read_csv(pristine, encoding="utf-8")

    corpus["cleaned"] = corpus["text"].astype(str).map(preprocessor.clean)
    corpus = corpus[corpus["cleaned"].str.len() > 0].reset_index(drop=True)
    corpus = assign_families(corpus)
    print(f"Corpus: {len(corpus)} rows -> {corpus['family'].nunique()} seed families")

    is_validation = split_by_family(corpus, VALIDATION_FRACTION, rng)
    corpus["split"] = np.where(is_validation, "validation", "train")

    # ---- 2. benchmark, filtered ---------------------------------------------
    bad = conflicting_phrases(load_templates())

    bench = pd.read_csv(EVALUATION / "real_world_test_results.csv",
                        encoding="utf-8")[["text", "intent"]]
    start = len(bench)

    key = bench["text"].astype(str).str.strip().str.lower()
    bench = bench[~key.isin(bad)]
    dropped_conflict = start - len(bench)

    mask = ((bench["intent"] == "greeting")
            & bench["text"].astype(str).str.lower().str.contains(DISTRESS))
    dropped_distress = int(mask.sum())
    bench = bench[~mask]

    bench["cleaned"] = bench["text"].astype(str).map(preprocessor.clean)
    bench = (bench[bench["cleaned"].str.len() > 0]
             .drop_duplicates("cleaned")
             .reset_index(drop=True))

    print(f"Benchmark: {start} rows"
          f" -{dropped_conflict} contradictory labels"
          f" -{dropped_distress} distress-mislabelled greetings"
          f" -> {len(bench)} unique usable")

    # ---- 3. hold out half the benchmark, by family --------------------------
    bench = assign_families(bench)
    is_heldout = split_by_family(bench, HELDOUT_FRACTION, rng)
    heldout, foldable = bench[is_heldout], bench[~is_heldout]
    print(f"           {bench['family'].nunique()} families -> "
          f"{len(foldable)} folded into training / {len(heldout)} held out")

    # Protect the off-topic guardrail: never train the catch-all intent on
    # phrases with no disaster-domain anchor. Held-out rows keep their labels,
    # so this trade shows up honestly in the benchmark score.
    vague = ((foldable["intent"] == "status_check_general")
             & ~foldable["cleaned"].str.contains(DOMAIN_ANCHOR))
    if vague.any():
        print(f"           withholding {int(vague.sum())} content-free "
              f"status_check_general rows (guardrail protection)")
        foldable = foldable[~vague]

    # ---- 4. write -----------------------------------------------------------
    added = foldable[["text", "intent"]].copy()
    added["split"] = "train"
    v2 = pd.concat([corpus[["text", "intent", "split"]], added], ignore_index=True)
    v2.to_csv(DATASETS / "training_dataset.csv", index=False, encoding="utf-8")

    heldout[["text", "intent"]].to_csv(EVALUATION / "heldout_benchmark.csv",
                                       index=False, encoding="utf-8")

    counts = v2["split"].value_counts()
    print(f"\nv2 training_dataset.csv: {len(v2)} rows "
          f"({counts.get('train', 0)} train / {counts.get('validation', 0)} validation)")
    print(f"heldout_benchmark.csv  : {len(heldout)} rows, never trained on")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
