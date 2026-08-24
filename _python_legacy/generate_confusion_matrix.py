"""
Script to generate, display, and export Confusion Matrix before DAPT (Domain-Adaptive Pre-training / Augmentation)
"""
import os
import json
import sys
import pandas as pd
import numpy as np
from sklearn.metrics import confusion_matrix

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure offline-nlp is in sys.path
project_root = os.getcwd()
nlp_dir = os.path.join(project_root, 'offline-nlp')
if nlp_dir not in sys.path:
    sys.path.insert(0, nlp_dir)

from src.engine import get_engine

def generate_confusion_matrix_before_dapt():
    print("🤖 Loading IntentEngine (Pre-DAPT Baseline Model)...")
    engine = get_engine()

    # Load validation dataset
    val_file = os.path.join(project_root, 'validation_dataset.json')
    if not os.path.exists(val_file):
        val_file = os.path.join(nlp_dir, 'validation_dataset.json')

    with open(val_file, 'r', encoding='utf-8') as f:
        dataset = json.load(f)

    print(f"📊 Running predictions across {len(dataset)} validation samples...")
    y_true = []
    y_pred = []

    for sample in dataset:
        query = sample['query']
        expected = sample['expected_intent']
        res = engine.predict(query)
        predicted = res['intent']
        
        y_true.append(expected)
        y_pred.append(predicted)

    # Get sorted unique labels
    labels = sorted(list(set(y_true) | set(y_pred)))
    
    # Compute confusion matrix
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    cm_df = pd.DataFrame(cm, index=labels, columns=labels)

    # Save to CSV
    csv_path = os.path.join(project_root, 'confusion_matrix_before_dapt.csv')
    cm_df.to_csv(csv_path, encoding='utf-8')
    print(f"✅ Confusion Matrix CSV saved to: {csv_path}")

    # Plot & Save Confusion Matrix Image
    try:
        import matplotlib.pyplot as plt
        import seaborn as sns

        plt.figure(figsize=(14, 11))
        sns.heatmap(cm_df, annot=True, fmt='d', cmap='Blues', cbar=True,
                    xticklabels=labels, yticklabels=labels)
        plt.title('Intent Classification Confusion Matrix (Before DAPT)', fontsize=16, fontweight='bold', pad=15)
        plt.xlabel('Predicted Intent Label', fontsize=12, labelpad=10)
        plt.ylabel('Ground Truth (Expected) Intent Label', fontsize=12, labelpad=10)
        plt.xticks(rotation=45, ha='right', fontsize=9)
        plt.yticks(rotation=0, fontsize=9)
        plt.tight_layout()

        img_path = os.path.join(project_root, 'confusion_matrix_before_dapt.png')
        plt.savefig(img_path, dpi=300)
        plt.close()
        print(f"🖼️ Heatmap graphic saved to: {img_path}")
    except Exception as e:
        print(f"[Note] Image generation skipped: {e}")

    # Extract Top Misclassifications
    misclassifications = []
    for i, true_label in enumerate(labels):
        for j, pred_label in enumerate(labels):
            if i != j and cm[i, j] > 0:
                misclassifications.append({
                    'Expected Intent': true_label,
                    'Predicted Intent': pred_label,
                    'Misclassified Count': cm[i, j]
                })

    misc_df = pd.DataFrame(misclassifications).sort_values(by='Misclassified Count', ascending=False)
    
    print("\n=== CONFUSION MATRIX SUMMARY (BEFORE DAPT) ===")
    print(f"Total Evaluated: {len(y_true)}")
    print(f"Correct Classifications: {np.trace(cm)} / {len(y_true)}")
    print(f"Overall Accuracy: {(np.trace(cm) / len(y_true)) * 100:.2f}%\n")
    
    print("=== TOP MISCLASSIFIED INTENTS (BEFORE DAPT) ===")
    if not misc_df.empty:
        print(misc_df.to_string(index=False))
    else:
        print("No misclassifications detected!")

    return cm_df, misc_df

if __name__ == '__main__':
    generate_confusion_matrix_before_dapt()
