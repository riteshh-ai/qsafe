"""
Confusion Matrix Generator for NLP Model

Generates confusion matrix visualization for the offline NLP model,
showing prediction accuracy across all 25 intent classes.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys
import json

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
    from sklearn.metrics import confusion_matrix
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class ConfusionMatrixGenerator:
    """Generate confusion matrix visualization."""
    
    def __init__(self, project_root: Path = None):
        """Initialize generator."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.engine = get_engine(project_root)
        self.preprocessor = TextPreprocessor()
        self.metrics_dir = Path(__file__).parent
        
    def load_validation_data(self) -> pd.DataFrame:
        """Load validation dataset."""
        print("Loading validation data...")
        dataset_path = self.metrics_dir / 'training_dataset.csv'
        df = pd.read_csv(dataset_path, encoding='utf-8')
        return df[df['split'] == 'validation'].copy()
    
    def run_inference(self, df: pd.DataFrame) -> pd.DataFrame:
        """Run inference on dataframe."""
        print("Running inference...")
        texts = df['text'].tolist()
        results = [self.engine.predict(text) for text in texts]
        
        df = df.copy()
        df['predicted_intent'] = [r['intent'] for r in results]
        return df
    
    def generate_confusion_matrix(self, df: pd.DataFrame) -> tuple:
        """Generate confusion matrix and labels."""
        print("Generating confusion matrix...")
        
        # Get unique intents
        intents = sorted(df['intent'].unique())
        
        # Generate confusion matrix
        cm = confusion_matrix(df['intent'], df['predicted_intent'], labels=intents)
        
        return cm, intents
    
    def plot_confusion_matrix(self, cm: np.ndarray, intents: list, 
                            save_path: str = 'confusion_matrix.png'):
        """Generate and save confusion matrix heatmap with reference style."""
        print("Generating confusion matrix plot...")
        
        # Create figure with reference image style
        fig, ax = plt.subplots(figsize=(14, 12))
        
        # Use a different colormap similar to reference (red/blue style)
        sns.heatmap(cm, annot=True, fmt='d', cmap='RdBu_r', 
                   xticklabels=intents, yticklabels=intents,
                   cbar_kws={'label': 'Count'},
                   annot_kws={'size': 7},
                   linewidths=0.5, linecolor='gray')
        
        plt.title('Confusion Matrix: True vs Predicted Intents', fontsize=16, fontweight='bold', pad=20)
        plt.xlabel('Predicted Intent', fontsize=12, fontweight='bold')
        plt.ylabel('True Intent', fontsize=12, fontweight='bold')
        plt.xticks(rotation=45, ha='right', fontsize=8)
        plt.yticks(rotation=0, fontsize=8)
        plt.tight_layout()
        
        # Save figure
        output_path = self.metrics_dir / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Confusion matrix saved to {output_path}")
        plt.close()
        
        return str(output_path)
    
    def plot_normalized_confusion_matrix(self, cm: np.ndarray, intents: list,
                                       save_path: str = 'confusion_matrix_normalized.png'):
        """Generate normalized confusion matrix (percentages)."""
        print("Generating normalized confusion matrix...")
        
        # Normalize by row (true labels)
        cm_normalized = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]
        
        # Create figure
        plt.figure(figsize=(16, 14))
        
        # Plot heatmap with percentages
        sns.heatmap(cm_normalized, annot=True, fmt='.2f', cmap='Blues',
                   xticklabels=intents, yticklabels=intents,
                   cbar_kws={'label': 'Proportion'},
                   annot_kws={'size': 8},
                   vmin=0, vmax=1)
        
        plt.title('QSAFE NLP Normalized Confusion Matrix', fontsize=16, fontweight='bold', pad=20)
        plt.xlabel('Predicted Intent', fontsize=12, fontweight='bold')
        plt.ylabel('True Intent', fontsize=12, fontweight='bold')
        plt.xticks(rotation=45, ha='right', fontsize=9)
        plt.yticks(rotation=0, fontsize=9)
        plt.tight_layout()
        
        # Save figure
        output_path = self.metrics_dir / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Normalized confusion matrix saved to {output_path}")
        plt.close()
        
        return str(output_path)
    
    def plot_top_errors(self, cm: np.ndarray, intents: list, top_n: int = 10,
                      save_path: str = 'top_errors.png'):
        """Plot top N error patterns."""
        print("Generating top errors plot...")
        
        # Find off-diagonal elements (errors)
        errors = []
        for i in range(len(intents)):
            for j in range(len(intents)):
                if i != j and cm[i, j] > 0:
                    errors.append({
                        'true': intents[i],
                        'predicted': intents[j],
                        'count': cm[i, j]
                    })
        
        # Sort by count and take top N
        errors.sort(key=lambda x: x['count'], reverse=True)
        top_errors = errors[:top_n]
        
        if not top_errors:
            print("No errors to plot!")
            return None
        
        # Create bar plot
        fig, ax = plt.subplots(figsize=(12, 6))
        
        error_labels = [f"{e['true']} → {e['predicted']}" for e in top_errors]
        error_counts = [e['count'] for e in top_errors]
        
        bars = ax.barh(range(len(error_labels)), error_counts, color='coral')
        ax.set_yticks(range(len(error_labels)))
        ax.set_yticklabels(error_labels, fontsize=9)
        ax.set_xlabel('Error Count', fontsize=12, fontweight='bold')
        ax.set_title(f'Top {len(top_errors)} Misclassification Patterns', fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='x')
        
        # Add count labels
        for bar, count in zip(bars, error_counts):
            ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height()/2,
                   str(count), va='center', fontsize=9)
        
        plt.tight_layout()
        
        # Save figure
        output_path = self.metrics_dir / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Top errors plot saved to {output_path}")
        plt.close()
        
        return str(output_path)
    
    def generate_report(self, cm: np.ndarray, intents: list, df: pd.DataFrame) -> dict:
        """Generate confusion matrix analysis report."""
        # Calculate per-class accuracy
        per_class_accuracy = {}
        for i, intent in enumerate(intents):
            correct = cm[i, i]
            total = cm[i, :].sum()
            accuracy = correct / total if total > 0 else 0
            per_class_accuracy[intent] = {
                'accuracy': float(accuracy),
                'correct': int(correct),
                'total': int(total)
            }
        
        # Overall accuracy
        overall_accuracy = np.trace(cm) / cm.sum()
        
        # Find worst performing classes
        sorted_classes = sorted(per_class_accuracy.items(), key=lambda x: x[1]['accuracy'])
        worst_classes = sorted_classes[:5]
        best_classes = sorted_classes[-5:]
        
        report = {
            'overall_accuracy': float(overall_accuracy),
            'total_samples': int(cm.sum()),
            'total_correct': int(np.trace(cm)),
            'total_errors': int(cm.sum() - np.trace(cm)),
            'per_class_accuracy': per_class_accuracy,
            'worst_performing_classes': [
                {'intent': k, 'accuracy': v['accuracy'], 'correct': v['correct'], 'total': v['total']}
                for k, v in worst_classes
            ],
            'best_performing_classes': [
                {'intent': k, 'accuracy': v['accuracy'], 'correct': v['correct'], 'total': v['total']}
                for k, v in best_classes
            ]
        }
        
        return report
    
    def run_analysis(self) -> dict:
        """Run complete confusion matrix analysis."""
        print("="*60)
        print("CONFUSION MATRIX ANALYSIS")
        print("="*60)
        
        # Load data and run inference
        df = self.load_validation_data()
        df = self.run_inference(df)
        
        # Generate confusion matrix
        cm, intents = self.generate_confusion_matrix(df)
        
        # Generate plots
        cm_plot = self.plot_confusion_matrix(cm, intents)
        cm_norm_plot = self.plot_normalized_confusion_matrix(cm, intents)
        errors_plot = self.plot_top_errors(cm, intents)
        
        # Generate report
        report = self.generate_report(cm, intents, df)
        report['plots'] = {
            'confusion_matrix': cm_plot,
            'normalized_confusion_matrix': cm_norm_plot,
            'top_errors': errors_plot
        }
        
        # Save report
        report_path = self.metrics_dir / 'confusion_matrix_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"💾 Report saved to {report_path}")
        
        return report
    
    def print_summary(self, report: dict):
        """Print analysis summary."""
        print("\n" + "="*60)
        print("CONFUSION MATRIX SUMMARY")
        print("="*60)
        
        print(f"\nOverall Accuracy: {report['overall_accuracy']:.4f}")
        print(f"Total Samples: {report['total_samples']}")
        print(f"Correct: {report['total_correct']}")
        print(f"Errors: {report['total_errors']}")
        
        print("\n--- Best Performing Classes ---")
        for cls in report['best_performing_classes']:
            print(f"{cls['intent']}: {cls['accuracy']:.4f} ({cls['correct']}/{cls['total']})")
        
        print("\n--- Worst Performing Classes ---")
        for cls in report['worst_performing_classes']:
            print(f"{cls['intent']}: {cls['accuracy']:.4f} ({cls['correct']}/{cls['total']})")
        
        print("="*60)


def main():
    """Main entry point."""
    generator = ConfusionMatrixGenerator()
    report = generator.run_analysis()
    generator.print_summary(report)
    print("\n✅ Confusion matrix analysis complete!")


if __name__ == '__main__':
    main()
