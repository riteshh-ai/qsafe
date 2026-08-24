"""
Generate 2x2 Binary Confusion Matrix matching the user's reference visual style exactly ("Confusion Matrix — Without DAPT").
Calculates exact values from the QSAFE dataset.
"""

import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import seaborn as sns
from pathlib import Path

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

nlp_dir = Path("offline-nlp")
sys.path.insert(0, str(nlp_dir))

from src.model import ModelTrainer
from src.preprocessor import TextPreprocessor

def generate_exact_binary_cm():
    print("🤖 Loading trained model and dataset...")
    vectorizer, model = ModelTrainer.load_model(nlp_dir)
    preprocessor = TextPreprocessor()

    df = pd.read_csv(nlp_dir / "datasets" / "training_dataset.csv")
    cleaned_texts = [preprocessor.clean(t) for t in df["text"]]

    X = vectorizer.transform(cleaned_texts)
    preds = model.predict(X)
    df["pred_intent"] = preds

    # Binary Mapping:
    # Emergency / In-Scope Intent (TRUE) vs Non-Emergency / Fallback / Greeting (FALSE)
    non_emergency = ["fallback_unclear", "greeting", "goodbye_thanks"]
    df["true_binary"] = ~df["intent"].isin(non_emergency)
    df["pred_binary"] = ~df["pred_intent"].isin(non_emergency)

    from sklearn.metrics import confusion_matrix
    cm = confusion_matrix(df["true_binary"], df["pred_binary"], labels=[True, False])
    
    tp = cm[0, 0]  # True Positive
    fn = cm[0, 1]  # False Negative
    fp = cm[1, 0]  # False Positive
    tn = cm[1, 1]  # True Negative

    print(f"Dataset Evaluation Matrix (Total N={len(df)}):")
    print(f"TP: {tp:,} | FN: {fn:,} | FP: {fp:,} | TN: {tn:,}")

    # Set up figure matching the exact reference style
    plt.rcParams['font.family'] = 'DejaVu Serif'
    fig, ax = plt.subplots(figsize=(7.5, 5.5), dpi=300)

    # Custom color normalization & formatting
    cm_data = np.array([[tp, fn], [fp, tn]])

    # Heatmap plot
    im = ax.imshow(cm_data, cmap='Blues', interpolation='nearest', aspect='auto')

    # Add Colorbar
    cbar = fig.colorbar(im, ax=ax, pad=0.03)
    cbar.ax.tick_params(labelsize=11)
    cbar.formatter = ticker.FuncFormatter(lambda x, p: f"{int(x):,}")
    cbar.update_ticks()

    # Labels and Ticks
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(['TRUE', 'FALSE'], fontsize=12, fontweight='normal')
    ax.set_yticklabels(['TRUE', 'FALSE'], fontsize=12, fontweight='normal')

    ax.set_xlabel('Predicted Label', fontsize=13, labelpad=10)
    ax.set_title('Confusion Matrix — Without DAPT', fontsize=14, pad=15, fontweight='normal')

    # Enable all tick marks on outer borders to match LaTeX / PGF style
    ax.tick_params(top=True, bottom=True, left=True, right=True, 
                   labeltop=False, labelbottom=True, labelleft=True, labelright=False,
                   direction='in', length=5)

    # Annotate numbers in cell centers with comma formatting
    for i in range(2):
        for j in range(2):
            val = cm_data[i, j]
            # Select text color based on cell background intensity
            color = "white" if val > (cm_data.max() / 2) else "black"
            ax.text(j, i, f"{val:,}", ha="center", va="center", color=color, fontsize=18)

    plt.tight_layout()

    # Save artifact images
    out_png = "confusion_matrix_without_dapt.png"
    plt.savefig(out_png, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Generated exact styled confusion matrix image: {out_png}")

    # Save validation split 2x2 binary matrix as well for completeness
    val_df = df[df["split"] == "validation"].copy()
    cm_val = confusion_matrix(val_df["true_binary"], val_df["pred_binary"], labels=[True, False])
    
    fig, ax = plt.subplots(figsize=(7.5, 5.5), dpi=300)
    im = ax.imshow(cm_val, cmap='Blues', interpolation='nearest', aspect='auto')
    cbar = fig.colorbar(im, ax=ax, pad=0.03)
    cbar.ax.tick_params(labelsize=11)
    cbar.formatter = ticker.FuncFormatter(lambda x, p: f"{int(x):,}")
    cbar.update_ticks()

    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(['TRUE', 'FALSE'], fontsize=12)
    ax.set_yticklabels(['TRUE', 'FALSE'], fontsize=12)
    ax.set_xlabel('Predicted Label', fontsize=13, labelpad=10)
    ax.set_title('Confusion Matrix — Without DAPT (Validation Split)', fontsize=14, pad=15)
    ax.tick_params(top=True, bottom=True, left=True, right=True, direction='in', length=5)

    for i in range(2):
        for j in range(2):
            val = cm_val[i, j]
            color = "white" if val > (cm_val.max() / 2) else "black"
            ax.text(j, i, f"{val:,}", ha="center", va="center", color=color, fontsize=18)

    plt.tight_layout()
    out_val_png = "confusion_matrix_without_dapt_validation.png"
    plt.savefig(out_val_png, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Generated validation split confusion matrix image: {out_val_png}")

if __name__ == "__main__":
    generate_exact_binary_cm()
