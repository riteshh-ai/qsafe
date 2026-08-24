"""
Generate Confusion Matrix with DAPT (Domain-Adaptive Pre-training / Augmentation)
Produces both 2x2 Binary graphic ('Confusion Matrix — With DAPT') and 25x25 Multiclass matrix.
"""

import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import seaborn as sns
from pathlib import Path
from sklearn.metrics import confusion_matrix

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

nlp_dir = Path("offline-nlp")
sys.path.insert(0, str(nlp_dir))

from src.engine import get_engine

def generate_dapt_matrix():
    print("🤖 Loading Post-DAPT Intent Engine...")
    engine = get_engine(nlp_dir)

    df = pd.read_csv(nlp_dir / "datasets" / "training_dataset.csv")
    
    preds = []
    for text in df["text"]:
        res = engine.predict(text)
        preds.append(res["intent"])

    df["pred_intent"] = preds

    # Binary Mapping
    non_emergency = ["fallback_unclear", "greeting", "goodbye_thanks"]
    df["true_binary"] = ~df["intent"].isin(non_emergency)
    df["pred_binary"] = ~df["pred_intent"].isin(non_emergency)

    cm_bin = confusion_matrix(df["true_binary"], df["pred_binary"], labels=[True, False])
    
    tp = cm_bin[0, 0]
    fn = cm_bin[0, 1]
    fp = cm_bin[1, 0]
    tn = cm_bin[1, 1]

    print(f"Post-DAPT Matrix (Total N={len(df)}):")
    print(f"TP: {tp:,} | FN: {fn:,} | FP: {fp:,} | TN: {tn:,}")

    # Set up matplotlib style matching the exact reference
    plt.rcParams['font.family'] = 'DejaVu Serif'
    fig, ax = plt.subplots(figsize=(7.5, 5.5), dpi=300)

    cm_data = np.array([[tp, fn], [fp, tn]])

    # Heatmap plot
    im = ax.imshow(cm_data, cmap='Blues', interpolation='nearest', aspect='auto')

    # Colorbar
    cbar = fig.colorbar(im, ax=ax, pad=0.03)
    cbar.ax.tick_params(labelsize=11)
    cbar.formatter = ticker.FuncFormatter(lambda x, p: f"{int(x):,}")
    cbar.update_ticks()

    # Labels and Ticks
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(['TRUE', 'FALSE'], fontsize=12)
    ax.set_yticklabels(['TRUE', 'FALSE'], fontsize=12)

    ax.set_xlabel('Predicted Label', fontsize=13, labelpad=10)
    ax.set_title('Confusion Matrix — With DAPT', fontsize=14, pad=15)

    ax.tick_params(top=True, bottom=True, left=True, right=True, 
                   labeltop=False, labelbottom=True, labelleft=True, labelright=False,
                   direction='in', length=5)

    for i in range(2):
        for j in range(2):
            val = cm_data[i, j]
            color = "white" if val > (cm_data.max() / 2) else "black"
            ax.text(j, i, f"{val:,}", ha="center", va="center", color=color, fontsize=18)

    plt.tight_layout()

    out_png = "confusion_matrix_with_dapt.png"
    plt.savefig(out_png, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Generated 2x2 binary confusion matrix image: {out_png}")

    # 25-Class Multiclass Post-DAPT Heatmap
    labels = sorted(list(set(df["intent"]) | set(df["pred_intent"])))
    cm_multi = confusion_matrix(df["intent"], df["pred_intent"], labels=labels)
    cm_multi_df = pd.DataFrame(cm_multi, index=labels, columns=labels)

    csv_path = "confusion_matrix_with_dapt_multiclass.csv"
    cm_multi_df.to_csv(csv_path, encoding='utf-8')

    plt.figure(figsize=(14, 11))
    sns.heatmap(cm_multi_df, annot=True, fmt='d', cmap='Blues', cbar=True,
                xticklabels=labels, yticklabels=labels)
    plt.title('Intent Classification Confusion Matrix (With DAPT)', fontsize=16, fontweight='bold', pad=15)
    plt.xlabel('Predicted Intent Label', fontsize=12, labelpad=10)
    plt.ylabel('Ground Truth (Expected) Intent Label', fontsize=12, labelpad=10)
    plt.xticks(rotation=45, ha='right', fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()

    out_multi_png = "confusion_matrix_with_dapt_multiclass.png"
    plt.savefig(out_multi_png, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"🖼️ Generated 25-class multiclass heatmap image: {out_multi_png}")

if __name__ == "__main__":
    generate_dapt_matrix()
