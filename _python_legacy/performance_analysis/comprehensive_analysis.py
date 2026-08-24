"""
Comprehensive Performance Analysis for QSAFE Offline NLP Engine

This script generates detailed performance visualizations including:
- Per-class performance analysis
- Confusion matrix
- Language-specific performance
- Feature importance analysis
- Error analysis
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys
import json
from typing import Dict, List, Tuple
from collections import Counter

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
    from src.model import ModelTrainer
    from sklearn.metrics import confusion_matrix, classification_report
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class ComprehensiveAnalyzer:
    """Generate comprehensive performance analysis and visualizations."""
    
    def __init__(self, project_root: Path = None):
        """Initialize analyzer."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.engine = get_engine(project_root)
        self.preprocessor = TextPreprocessor()
        
    def load_validation_data(self) -> pd.DataFrame:
        """Load validation split from training dataset."""
        train_path = Path(__file__).parent / 'training_dataset.csv'
        df = pd.read_csv(train_path, encoding='utf-8')
        return df[df['split'] == 'validation'].copy()
    
    def run_full_validation(self) -> Tuple[pd.DataFrame, List[Dict]]:
        """Run inference on full validation set."""
        print("Loading validation data...")
        val_df = self.load_validation_data()
        
        print(f"Running inference on {len(val_df)} validation samples...")
        texts = val_df['text'].tolist()
        results = [self.engine.predict(text) for text in texts]
        
        # Add predictions to dataframe
        val_df['predicted_intent'] = [r['intent'] for r in results]
        val_df['confidence'] = [r['confidence'] for r in results]
        val_df['source'] = [r['source'] for r in results]
        val_df['urgency'] = [r['urgency'] for r in results]
        
        return val_df, results
    
    def plot_confusion_matrix(self, val_df: pd.DataFrame, save_path: str = 'confusion_matrix.png'):
        """Generate and save confusion matrix visualization."""
        print("Generating confusion matrix...")
        
        # Get unique intents
        intents = sorted(val_df['intent'].unique())
        
        # Generate confusion matrix
        cm = confusion_matrix(val_df['intent'], val_df['predicted_intent'], labels=intents)
        
        # Create figure
        plt.figure(figsize=(16, 14))
        
        # Plot heatmap
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                   xticklabels=intents, yticklabels=intents,
                   cbar_kws={'label': 'Count'})
        
        plt.title('QSAFE NLP Confusion Matrix', fontsize=16, fontweight='bold', pad=20)
        plt.xlabel('Predicted Intent', fontsize=12)
        plt.ylabel('True Intent', fontsize=12)
        plt.xticks(rotation=45, ha='right')
        plt.yticks(rotation=0)
        plt.tight_layout()
        
        # Save figure
        output_path = Path(__file__).parent / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Confusion matrix saved to {output_path}")
        plt.close()
        
        return cm
    
    def plot_per_class_performance(self, val_df: pd.DataFrame, save_path: str = 'per_class_performance.png'):
        """Generate per-class performance metrics."""
        print("Generating per-class performance analysis...")
        
        intents = sorted(val_df['intent'].unique())
        
        # Calculate per-class metrics
        per_class_metrics = []
        for intent in intents:
            class_df = val_df[val_df['intent'] == intent]
            correct = (class_df['intent'] == class_df['predicted_intent']).sum()
            total = len(class_df)
            accuracy = correct / total if total > 0 else 0
            
            per_class_metrics.append({
                'intent': intent,
                'accuracy': accuracy,
                'samples': total
            })
        
        # Convert to DataFrame and sort
        metrics_df = pd.DataFrame(per_class_metrics).sort_values('accuracy')
        
        # Create figure
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # Plot horizontal bar chart
        bars = ax.barh(metrics_df['intent'], metrics_df['accuracy'], color='steelblue')
        
        # Add sample count labels
        for i, (bar, row) in enumerate(zip(bars, metrics_df.itertuples())):
            ax.text(bar.get_width() + 0.01, bar.get_y() + bar.get_height()/2, 
                   f"n={row.samples}", va='center', fontsize=9)
        
        ax.set_xlabel('Accuracy', fontsize=12)
        ax.set_ylabel('Intent Class', fontsize=12)
        ax.set_title('Per-Class Accuracy on Validation Set', fontsize=14, fontweight='bold')
        ax.set_xlim([0.8, 1.0])
        ax.grid(True, alpha=0.3, axis='x')
        
        plt.tight_layout()
        
        # Save figure
        output_path = Path(__file__).parent / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Per-class performance saved to {output_path}")
        plt.close()
        
        return metrics_df
    
    def analyze_by_language(self, val_df: pd.DataFrame) -> Dict:
        """Analyze performance by language."""
        print("Analyzing language-specific performance...")
        
        def detect_language(text):
            if any('\u0900' <= c <= '\u097F' for c in str(text)):
                return 'Devanagari'
            elif any(c.isalpha() and not c.isascii() for c in str(text)):
                return 'Mixed'
            else:
                return 'English'
        
        val_df = val_df.copy()
        val_df['language'] = val_df['text'].apply(detect_language)
        
        lang_metrics = {}
        for lang in ['English', 'Devanagari', 'Mixed']:
            lang_df = val_df[val_df['language'] == lang]
            if len(lang_df) > 0:
                accuracy = (lang_df['intent'] == lang_df['predicted_intent']).mean()
                lang_metrics[lang] = {
                    'samples': len(lang_df),
                    'accuracy': accuracy,
                    'avg_confidence': lang_df['confidence'].mean()
                }
        
        return lang_metrics
    
    def plot_language_performance(self, lang_metrics: Dict, save_path: str = 'language_performance.png'):
        """Plot language-specific performance."""
        print("Generating language performance visualization...")
        
        languages = list(lang_metrics.keys())
        accuracies = [lang_metrics[lang]['accuracy'] for lang in languages]
        samples = [lang_metrics[lang]['samples'] for lang in languages]
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        bars = ax.bar(languages, accuracies, color=['steelblue', 'coral', 'lightgreen'])
        
        # Add sample count labels
        for bar, sample_count in zip(bars, samples):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                   f"n={sample_count}", ha='center', fontsize=10)
        
        ax.set_ylabel('Accuracy', fontsize=12)
        ax.set_xlabel('Language', fontsize=12)
        ax.set_title('Performance by Language Type', fontsize=14, fontweight='bold')
        ax.set_ylim([0.8, 1.0])
        ax.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        # Save figure
        output_path = Path(__file__).parent / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Language performance saved to {output_path}")
        plt.close()
    
    def analyze_inference_sources(self, val_df: pd.DataFrame) -> Dict:
        """Analyze distribution of inference sources."""
        source_counts = val_df['source'].value_counts().to_dict()
        source_accuracy = {}
        
        for source in source_counts.keys():
            source_df = val_df[val_df['source'] == source]
            accuracy = (source_df['intent'] == source_df['predicted_intent']).mean()
            source_accuracy[source] = accuracy
        
        return {
            'counts': source_counts,
            'accuracy': source_accuracy
        }
    
    def plot_source_distribution(self, source_analysis: Dict, save_path: str = 'source_distribution.png'):
        """Plot inference source distribution."""
        print("Generating source distribution visualization...")
        
        sources = list(source_analysis['counts'].keys())
        counts = list(source_analysis['counts'].values())
        accuracies = [source_analysis['accuracy'].get(source, 0) for source in sources]
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # Plot counts
        ax1.bar(sources, counts, color='steelblue')
        ax1.set_ylabel('Count', fontsize=12)
        ax1.set_xlabel('Inference Source', fontsize=12)
        ax1.set_title('Distribution of Inference Sources', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3, axis='y')
        
        # Plot accuracy by source
        ax2.bar(sources, accuracies, color='coral')
        ax2.set_ylabel('Accuracy', fontsize=12)
        ax2.set_xlabel('Inference Source', fontsize=12)
        ax2.set_title('Accuracy by Inference Source', fontsize=14, fontweight='bold')
        ax2.set_ylim([0.8, 1.0])
        ax2.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        # Save figure
        output_path = Path(__file__).parent / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Source distribution saved to {output_path}")
        plt.close()
    
    def analyze_errors(self, val_df: pd.DataFrame) -> pd.DataFrame:
        """Analyze misclassified samples."""
        print("Analyzing misclassifications...")
        
        errors_df = val_df[val_df['intent'] != val_df['predicted_intent']].copy()
        
        if len(errors_df) > 0:
            print(f"Found {len(errors_df)} misclassifications out of {len(val_df)} samples")
            return errors_df
        else:
            print("No misclassifications found!")
            return pd.DataFrame()
    
    def generate_summary_report(self, val_df: pd.DataFrame, lang_metrics: Dict, 
                                source_analysis: Dict, metrics_df: pd.DataFrame) -> Dict:
        """Generate comprehensive summary report."""
        overall_accuracy = (val_df['intent'] == val_df['predicted_intent']).mean()
        
        summary = {
            'overall_metrics': {
                'total_samples': len(val_df),
                'correct_predictions': int((val_df['intent'] == val_df['predicted_intent']).sum()),
                'overall_accuracy': float(overall_accuracy),
                'avg_confidence': float(val_df['confidence'].mean()),
                'high_confidence_predictions': int((val_df['confidence'] > 0.9).sum()),
                'low_confidence_predictions': int((val_df['confidence'] < 0.5).sum())
            },
            'language_performance': lang_metrics,
            'source_analysis': source_analysis,
            'per_class_summary': {
                'best_class': metrics_df.iloc[-1]['intent'],
                'best_accuracy': float(metrics_df.iloc[-1]['accuracy']),
                'worst_class': metrics_df.iloc[0]['intent'],
                'worst_accuracy': float(metrics_df.iloc[0]['accuracy']),
                'avg_per_class_accuracy': float(metrics_df['accuracy'].mean())
            }
        }
        
        return summary


def main():
    """Main entry point for comprehensive analysis."""
    print("="*60)
    print("QSAFE NLP Comprehensive Performance Analysis")
    print("="*60)
    
    analyzer = ComprehensiveAnalyzer()
    
    # Run validation
    val_df, results = analyzer.run_full_validation()
    
    # Generate visualizations
    cm = analyzer.plot_confusion_matrix(val_df, 'confusion_matrix.png')
    metrics_df = analyzer.plot_per_class_performance(val_df, 'per_class_performance.png')
    
    # Language analysis
    lang_metrics = analyzer.analyze_by_language(val_df)
    analyzer.plot_language_performance(lang_metrics, 'language_performance.png')
    
    # Source analysis
    source_analysis = analyzer.analyze_inference_sources(val_df)
    analyzer.plot_source_distribution(source_analysis, 'source_distribution.png')
    
    # Error analysis
    errors_df = analyzer.analyze_errors(val_df)
    
    # Generate summary
    summary = analyzer.generate_summary_report(val_df, lang_metrics, source_analysis, metrics_df)
    
    # Save summary
    output_path = Path(__file__).parent / 'comprehensive_summary.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    print(f"💾 Comprehensive summary saved to {output_path}")
    
    # Print summary
    print("\n" + "="*60)
    print("COMPREHENSIVE ANALYSIS SUMMARY")
    print("="*60)
    print(f"Total Samples: {summary['overall_metrics']['total_samples']}")
    print(f"Overall Accuracy: {summary['overall_metrics']['overall_accuracy']:.4f}")
    print(f"Average Confidence: {summary['overall_metrics']['avg_confidence']:.4f}")
    print(f"Best Performing Class: {summary['per_class_summary']['best_class']} ({summary['per_class_summary']['best_accuracy']:.4f})")
    print(f"Worst Performing Class: {summary['per_class_summary']['worst_class']} ({summary['per_class_summary']['worst_accuracy']:.4f})")
    
    print("\n--- Language Performance ---")
    for lang, metrics in summary['language_performance'].items():
        print(f"{lang}: {metrics['accuracy']:.4f} (n={metrics['samples']})")
    
    print("\n--- Inference Source Distribution ---")
    for source, count in summary['source_analysis']['counts'].items():
        acc = summary['source_analysis']['accuracy'].get(source, 0)
        print(f"{source}: {count} samples (accuracy: {acc:.4f})")
    
    print("="*60)
    print("\n✅ Comprehensive analysis complete!")


if __name__ == '__main__':
    main()
