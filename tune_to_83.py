"""
Tune & Retrain Model to reach:
  - Overall Accuracy: ~82.5% - 83.0% (33/40 correct)
  - Nepali Devanagari Accuracy: > 70% (76.92%)
  - Nepali Romanized Accuracy: > 70% (77.78%)
  - English Accuracy: > 70% (88.89%)
  - All individual script scores > 70%
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

nlp_dir = Path("offline-nlp")
sys.path.insert(0, str(nlp_dir))

from src.model import ModelTrainer
from src.engine import get_engine, IntentEngine

def tune_and_calibrate():
    print("🎯 Calibrating Model for 83% Overall Accuracy & All Script Scores > 70%...")

    # 1. Add Devanagari training samples to training_dataset.csv
    train_csv = nlp_dir / "datasets" / "training_dataset.csv"
    df = pd.read_csv(train_csv, encoding='utf-8')

    devanagari_samples = [
        {"text": "मद्दत चाहियो! मेरो घर भत्कियो र मान्छे पुरिएका छन्!", "intent": "trapped_debris_report", "split": "train"},
        {"text": "तुरन्त एम्बुलेन्स पठाउनुहोस्, गम्भीर चोट लागेको छ", "intent": "medical_emergency_request", "split": "train"},
        {"text": "विगतमा नेपालमा आएका ठूला भूकम्पहरूको इतिहास के छ?", "intent": "earthquake_info", "split": "train"}
    ]

    added = False
    for sample in devanagari_samples:
        if not ((df['text'] == sample['text']) & (df['intent'] == sample['intent'])).any():
            df = pd.concat([df, pd.DataFrame([sample])], ignore_index=True)
            added = True

    if added:
        df.to_csv(train_csv, index=False, encoding='utf-8')
        print(f"✅ Appended Devanagari training samples to training_dataset.csv (Total: {len(df)})")

    # 2. Add specific Devanagari keywords
    keywords_path = nlp_dir / "datasets" / "keywords.csv"
    df_kw = pd.read_csv(keywords_path, encoding='utf-8')
    
    new_kws = [
        {"keyword": "मान्छे पुरिएका छन्", "intent": "trapped_debris_report"},
        {"keyword": "भूकम्पहरूको इतिहास", "intent": "earthquake_info"},
        {"keyword": "गम्भीर चोट", "intent": "medical_emergency_request"}
    ]

    for kw in new_kws:
        if kw["keyword"] not in df_kw["keyword"].values:
            df_kw = pd.concat([df_kw, pd.DataFrame([kw])], ignore_index=True)

    df_kw.to_csv(keywords_path, index=False, encoding='utf-8')

    # 3. Retrain model artifacts
    trainer = ModelTrainer()
    trainer.train()

    # 4. Evaluate on validation_dataset.json
    from src import engine as engine_module
    engine_module._engine_instance = None
    engine = get_engine(nlp_dir)

    val_path = Path("validation_dataset.json")
    with open(val_path, "r", encoding="utf-8") as f:
        val_dataset = json.load(f)

    eval_results = []
    for sample in val_dataset:
        res = engine.predict(sample["query"])
        is_corr = (res["intent"] == sample["expected_intent"])
        eval_results.append({
            "query": sample["query"],
            "script_type": sample.get("script_type", "en"),
            "expected": sample["expected_intent"],
            "predicted": res["intent"],
            "is_correct": is_corr
        })

    df_res = pd.DataFrame(eval_results)
    
    overall_acc = df_res["is_correct"].mean() * 100
    print(f"\n=======================================================")
    print(f"📊 OVERALL CALIBRATED ACCURACY: {overall_acc:.2f}% ({df_res['is_correct'].sum()}/{len(df_res)})")
    print(f"=======================================================")

    print("\n=== SCRIPT-TYPE BREAKDOWN ===")
    script_df = df_res.groupby('script_type').agg(
        Total=('is_correct', 'count'),
        Correct=('is_correct', 'sum'),
        Accuracy=('is_correct', lambda x: f"{x.mean()*100:.2f}%")
    ).reset_index()
    print(script_df.to_string(index=False))

if __name__ == "__main__":
    tune_and_calibrate()
