"""
Error Distribution Graph Generator for NLP Model

Generates error distribution visualization similar to reference image,
showing confidence score distributions for validation vs test sets.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys
import json
from sklearn.model_selection import train_test_split

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class ErrorDistributionGenerator:
    """Generate error distribution visualization."""
    
    def __init__(self, project_root: Path = None):
        """Initialize generator."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.engine = get_engine(project_root)
        self.preprocessor = TextPreprocessor()
        self.metrics_dir = Path(__file__).parent
        
    def load_and_split_data(self) -> tuple:
        """Load data and create validation/test splits."""
        print("Loading and splitting data...")
        
        # Load dataset
        dataset_path = self.metrics_dir / 'training_dataset.csv'
        df = pd.read_csv(dataset_path, encoding='utf-8')
        
        # First split: 80% train+val, 20% test
        train_val_df, test_df = train_test_split(
            df, test_size=0.2, random_state=42, stratify=df['intent']
        )
        
        # Second split: 80% train, 20% val from train+val
        train_df, val_df = train_test_split(
            train_val_df, test_size=0.2, random_state=42, stratify=train_val_df['intent']
        )
        
        print(f"Train: {len(train_df)}, Validation: {len(val_df)}, Test: {len(test_df)}")
        return train_df, val_df, test_df
    
    def run_inference(self, df: pd.DataFrame) -> pd.DataFrame:
        """Run inference on dataframe and return results."""
        texts = df['text'].tolist()
        results = [self.engine.predict(text) for text in texts]
        
        df = df.copy()
        df['predicted_intent'] = [r['intent'] for r in results]
        df['confidence'] = [r['confidence'] for r in results]
        df['is_correct'] = df['intent'] == df['predicted_intent']
        
        return df
    
    def calculate_error_metrics(self, df: pd.DataFrame) -> dict:
        """Calculate error metrics for plotting."""
        # For classification, "error" = 1 - confidence for incorrect predictions
        # For correct predictions, error = 1 - confidence (to show calibration)
        
        errors_correct = 1 - df[df['is_correct']]['confidence'].values
        errors_incorrect = 1 - df[~df['is_correct']]['confidence'].values
        
        return {
            'correct_errors': errors_correct,
            'incorrect_errors': errors_incorrect,
            'all_confidences': df['confidence'].values,
            'accuracy': df['is_correct'].mean()
        }
    
    def plot_error_distribution(self, val_metrics: dict, test_metrics: dict, 
                               threshold: float = 0.25) -> str:
        """Generate error distribution plot similar to reference image."""
        print("Generating error distribution plot...")
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Plot validation errors (correct predictions)
        sns.kdeplot(val_metrics['correct_errors'], label='Validation Correct', 
                   color='blue', fill=True, alpha=0.3, ax=ax)
        
        # Plot validation errors (incorrect predictions)
        if len(val_metrics['incorrect_errors']) > 0:
            sns.kdeplot(val_metrics['incorrect_errors'], label='Validation Errors', 
                       color='red', fill=True, alpha=0.5, ax=ax)
        
        # Plot test errors (correct predictions)
        sns.kdeplot(test_metrics['correct_errors'], label='Test Correct', 
                   color='green', fill=True, alpha=0.3, linestyle='--', ax=ax)
        
        # Plot test errors (incorrect predictions)
        if len(test_metrics['incorrect_errors']) > 0:
            sns.kdeplot(test_metrics['incorrect_errors'], label='Test Errors', 
                       color='orange', fill=True, alpha=0.5, linestyle='--', ax=ax)
        
        # Add threshold line
        ax.axvline(x=threshold, color='black', linestyle='--', 
                  label=f'Threshold = {threshold}', linewidth=2)
        
        ax.set_xlabel('Classification Error (1 - Confidence)', fontsize=12)
        ax.set_ylabel('Density', fontsize=12)
        ax.set_title('Error Distribution: Validation vs Test', fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)
        ax.set_xlim([0, 1])
        
        plt.tight_layout()
        
        # Save plot
        output_path = self.metrics_dir / 'error_distribution.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Error distribution plot saved to {output_path}")
        plt.close()
        
        return str(output_path)
    
    def plot_confidence_distribution(self, val_metrics: dict, test_metrics: dict) -> str:
        """Generate confidence distribution plot."""
        print("Generating confidence distribution plot...")
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Plot validation confidences
        sns.kdeplot(val_metrics['all_confidences'], label='Validation', 
                   color='blue', fill=True, alpha=0.3, ax=ax)
        
        # Plot test confidences
        sns.kdeplot(test_metrics['all_confidences'], label='Test', 
                   color='red', fill=True, alpha=0.3, ax=ax)
        
        # Add threshold line
        threshold = 0.25
        ax.axvline(x=threshold, color='black', linestyle='--', 
                  label=f'Confidence Threshold = {threshold}', linewidth=2)
        
        ax.set_xlabel('Confidence Score', fontsize=12)
        ax.set_ylabel('Density', fontsize=12)
        ax.set_title('Confidence Distribution: Validation vs Test', fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)
        ax.set_xlim([0, 1])
        
        plt.tight_layout()
        
        # Save plot
        output_path = self.metrics_dir / 'confidence_distribution.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Confidence distribution plot saved to {output_path}")
        plt.close()
        
        return str(output_path)
    
    def generate_report(self, val_metrics: dict, test_metrics: dict) -> dict:
        """Generate comparison report."""
        report = {
            'validation': {
                'accuracy': float(val_metrics['accuracy']),
                'total_samples': len(val_metrics['all_confidences']),
                'correct_samples': len(val_metrics['correct_errors']),
                'incorrect_samples': len(val_metrics['incorrect_errors']),
                'mean_confidence': float(np.mean(val_metrics['all_confidences'])),
                'mean_error_correct': float(np.mean(val_metrics['correct_errors'])) if len(val_metrics['correct_errors']) > 0 else 0,
                'mean_error_incorrect': float(np.mean(val_metrics['incorrect_errors'])) if len(val_metrics['incorrect_errors']) > 0 else 0
            },
            'test': {
                'accuracy': float(test_metrics['accuracy']),
                'total_samples': len(test_metrics['all_confidences']),
                'correct_samples': len(test_metrics['correct_errors']),
                'incorrect_samples': len(test_metrics['incorrect_errors']),
                'mean_confidence': float(np.mean(test_metrics['all_confidences'])),
                'mean_error_correct': float(np.mean(test_metrics['correct_errors'])) if len(test_metrics['correct_errors']) > 0 else 0,
                'mean_error_incorrect': float(np.mean(test_metrics['incorrect_errors'])) if len(test_metrics['incorrect_errors']) > 0 else 0
            }
        }
        return report
    
    def run_analysis(self) -> dict:
        """Run complete error distribution analysis."""
        print("="*60)
        print("ERROR DISTRIBUTION ANALYSIS")
        print("="*60)
        
        # Load and split data
        train_df, val_df, test_df = self.load_and_split_data()
        
        # Run inference
        print("Running inference on validation set...")
        val_results = self.run_inference(val_df)
        
        print("Running inference on test set...")
        test_results = self.run_inference(test_df)
        
        # Calculate metrics
        val_metrics = self.calculate_error_metrics(val_results)
        test_metrics = self.calculate_error_metrics(test_results)
        
        # Generate plots
        error_plot = self.plot_error_distribution(val_metrics, test_metrics)
        conf_plot = self.plot_confidence_distribution(val_metrics, test_metrics)
        
        # Generate report
        report = self.generate_report(val_metrics, test_metrics)
        report['plots'] = {
            'error_distribution': error_plot,
            'confidence_distribution': conf_plot
        }
        
        # Save report
        report_path = self.metrics_dir / 'error_distribution_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"💾 Report saved to {report_path}")
        
        return report
    
    def print_summary(self, report: dict):
        """Print analysis summary."""
        print("\n" + "="*60)
        print("ERROR DISTRIBUTION SUMMARY")
        print("="*60)
        
        print("\n--- Validation Set ---")
        val = report['validation']
        print(f"Accuracy: {val['accuracy']:.4f}")
        print(f"Samples: {val['total_samples']} (Correct: {val['correct_samples']}, Errors: {val['incorrect_samples']})")
        print(f"Mean Confidence: {val['mean_confidence']:.4f}")
        print(f"Mean Error (Correct): {val['mean_error_correct']:.4f}")
        print(f"Mean Error (Incorrect): {val['mean_error_incorrect']:.4f}")
        
        print("\n--- Test Set ---")
        test = report['test']
        print(f"Accuracy: {test['accuracy']:.4f}")
        print(f"Samples: {test['total_samples']} (Correct: {test['correct_samples']}, Errors: {test['incorrect_samples']})")
        print(f"Mean Confidence: {test['mean_confidence']:.4f}")
        print(f"Mean Error (Correct): {test['mean_error_correct']:.4f}")
        print(f"Mean Error (Incorrect): {test['mean_error_incorrect']:.4f}")
        
        print("="*60)


def main():
    """Main entry point."""
    generator = ErrorDistributionGenerator()
    report = generator.run_analysis()
    generator.print_summary(report)
    print("\n✅ Error distribution analysis complete!")


if __name__ == '__main__':
    main()
