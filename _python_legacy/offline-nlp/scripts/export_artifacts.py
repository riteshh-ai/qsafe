"""One-time bridge: export the fitted scikit-learn artifacts to a Node-loadable form.

`model.joblib` and `vectorizer.joblib` are Python pickles; Node cannot read them and no
npm package reimplements scikit-learn. This script lifts the fitted weights out into a
portable JSON + float64 binary pair that `offline-nlp/node` loads at boot.

Run once, before the Python tree is archived:

    .venv/Scripts/python offline-nlp/scripts/export_artifacts.py

Outputs (checked in, ~3.5 MB total):
    offline-nlp/node/artifacts/vectorizer.json   vocabularies + n-gram config
    offline-nlp/node/artifacts/classifier.json   class labels + binary layout
    offline-nlp/node/artifacts/weights.bin       all float64 arrays, little-endian

Layout of weights.bin (contiguous float64, little-endian):
    [ word_idf | char_idf | coef (row-major, n_classes x n_features) | intercept ]
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "node" / "artifacts"


def main() -> int:
    vec_path = ROOT / "models" / "vectorizer.joblib"
    mdl_path = ROOT / "models" / "model.joblib"
    for p in (vec_path, mdl_path):
        if not p.exists():
            print(f"ERROR: missing artifact {p}", file=sys.stderr)
            return 1

    vec = joblib.load(vec_path)
    mdl = joblib.load(mdl_path)
    blocks = dict(vec.transformer_list)
    word, char = blocks["word_tfidf"], blocks["char_tfidf"]

    # Guard the assumptions the JS inference port is built on. If a future retrain
    # changes any of these, the Node side silently diverges - so fail loudly here.
    for name, tf in (("word", word), ("char", char)):
        assert tf.sublinear_tf is False, f"{name}: JS port assumes sublinear_tf=False"
        assert tf.smooth_idf is True, f"{name}: JS port assumes smooth_idf=True"
        assert tf.norm == "l2", f"{name}: JS port assumes norm='l2'"
        assert tf.binary is False, f"{name}: JS port assumes binary=False"
        assert tf.lowercase is False, f"{name}: JS port assumes lowercase=False"
    assert word.analyzer == "word" and char.analyzer == "char"
    assert word.token_pattern == r"(?u)\b\w\w+\b", "JS tokenizer is built for this pattern"

    word_idf = np.asarray(word.idf_, dtype=np.float64)
    char_idf = np.asarray(char.idf_, dtype=np.float64)
    coef = np.asarray(mdl.coef_, dtype=np.float64)
    intercept = np.asarray(mdl.intercept_, dtype=np.float64)
    classes = [str(c) for c in mdl.classes_]

    n_classes, n_features = coef.shape
    assert n_features == len(word_idf) + len(char_idf), "feature count mismatch"
    assert intercept.shape == (n_classes,)
    assert len(classes) == n_classes

    OUT.mkdir(parents=True, exist_ok=True)

    # --- vectorizer -------------------------------------------------------
    (OUT / "vectorizer.json").write_text(
        json.dumps(
            {
                "word": {
                    "vocabulary": {t: int(i) for t, i in word.vocabulary_.items()},
                    "ngramRange": list(word.ngram_range),
                    "nFeatures": int(len(word_idf)),
                },
                "char": {
                    "vocabulary": {t: int(i) for t, i in char.vocabulary_.items()},
                    "ngramRange": list(char.ngram_range),
                    "nFeatures": int(len(char_idf)),
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    # --- classifier + binary layout --------------------------------------
    offsets, cursor = {}, 0
    for key, arr in (
        ("wordIdf", word_idf),
        ("charIdf", char_idf),
        ("coef", coef.reshape(-1)),
        ("intercept", intercept),
    ):
        offsets[key] = {"offset": cursor, "length": int(arr.size)}
        cursor += arr.size

    (OUT / "classifier.json").write_text(
        json.dumps(
            {
                "classes": classes,
                "nClasses": int(n_classes),
                "nFeatures": int(n_features),
                "dtype": "float64",
                "byteOrder": "little",
                "layout": offsets,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )

    blob = np.concatenate(
        [word_idf, char_idf, coef.reshape(-1), intercept]
    ).astype("<f8")
    (OUT / "weights.bin").write_bytes(blob.tobytes())

    print(f"classes      : {n_classes}")
    print(f"features     : {n_features} (word {len(word_idf)} + char {len(char_idf)})")
    print(f"weights.bin  : {blob.nbytes:,} bytes ({blob.size:,} float64)")
    print(f"written to   : {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
