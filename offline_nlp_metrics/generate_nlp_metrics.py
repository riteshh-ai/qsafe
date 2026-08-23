"""
Offline NLP Model Performance Metrics Generator

This script generates comprehensive performance metrics specifically for the 
offline NLP model including accuracy, precision, recall, F1, confusion matrix,
and detailed analysis by language, intent class, and inference tier.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys
import json
from typing import Dict, List, Tuple
from collections import defaultdict, Counter

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
    from src.model import ModelTrainer
    from sklearn.metrics import (
        confusion_matrix, classification_report, 
        accuracy_score, precision_score, recall_score, f1_score
    )
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class NLPMetricsGenerator:
    """Generate comprehensive performance metrics for offline NLP model."""
    
    def __init__(self, project_root: Path = None):
        """Initialize metrics generator."""
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
    
    def run_validation(self) -> pd.DataFrame:
        """Run inference on validation set and return results."""
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
        val_df['latency_ms'] = [r['latency_ms'] for r in results]
        
        return val_df
    
    def calculate_core_metrics(self, val_df: pd.DataFrame) -> Dict:
        """Calculate core classification metrics."""
        y_true = val_df['intent'].values
        y_pred = val_df['predicted_intent'].values
        
        accuracy = accuracy_score(y_true, y_pred)
        precision_macro = precision_score(y_true, y_pred, average='macro', zero_division=0)
        recall_macro = recall_score(y_true, y_pred, average='macro', zero_division=0)
        f1_macro = f1_score(y_true, y_pred, average='macro', zero_division=0)
        
        precision_weighted = precision_score(y_true, y_pred, average='weighted', zero_division=0)
        recall_weighted = recall_score(y_true, y_pred, average='weighted', zero_division=0)
        f1_weighted = f1_score(y_true, y_pred, average='weighted', zero_division=0)
        
        return {
            'accuracy': float(accuracy),
            'precision_macro': float(precision_macro),
            'recall_macro': float(recall_macro),
            'f1_macro': float(f1_macro),
            'precision_weighted': float(precision_weighted),
            'recall_weighted': float(recall_weighted),
            'f1_weighted': float(f1_weighted)
        }
    
    def calculate_per_class_metrics(self, val_df: pd.DataFrame) -> Dict:
        """Calculate per-class performance metrics."""
        intents = sorted(val_df['intent'].unique())
        
        per_class_metrics = {}
        for intent in intents:
            class_df = val_df[val_df['intent'] == intent]
            correct = (class_df['intent'] == class_df['predicted_intent']).sum()
            total = len(class_df)
            accuracy = correct / total if total > 0 else 0
            
            # Calculate precision, recall, F1 for this class
            y_true_class = (val_df['intent'] == intent).astype(int)
            y_pred_class = (val_df['predicted_intent'] == intent).astype(int)
            
            precision = precision_score(y_true_class, y_pred_class, zero_division=0)
            recall = recall_score(y_true_class, y_pred_class, zero_division=0)
            f1 = f1_score(y_true_class, y_pred_class, zero_division=0)
            
            per_class_metrics[intent] = {
                'accuracy': float(accuracy),
                'precision': float(precision),
                'recall': float(recall),
                'f1': float(f1),
                'support': int(total),
                'correct_predictions': int(correct)
            }
        
        return per_class_metrics
    
    def analyze_by_language(self, val_df: pd.DataFrame) -> Dict:
        """Analyze performance by language."""
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
                avg_confidence = lang_df['confidence'].mean()
                avg_latency = lang_df['latency_ms'].mean()
                
                lang_metrics[lang] = {
                    'samples': int(len(lang_df)),
                    'accuracy': float(accuracy),
                    'avg_confidence': float(avg_confidence),
                    'avg_latency_ms': float(avg_latency)
                }
        
        return lang_metrics
    
    def analyze_by_inference_tier(self, val_df: pd.DataFrame) -> Dict:
        """Analyze performance by inference tier."""
        tier_metrics = {}
        
        for source in ['keyword', 'keyword_fuzzy', 'ml', 'fallback']:
            source_df = val_df[val_df['source'] == source]
            if len(source_df) > 0:
                accuracy = (source_df['intent'] == source_df['predicted_intent']).mean()
                avg_confidence = source_df['confidence'].mean()
                avg_latency = source_df['latency_ms'].mean()
                
                tier_metrics[source] = {
                    'count': int(len(source_df)),
                    'accuracy': float(accuracy),
                    'avg_confidence': float(avg_confidence),
                    'avg_latency_ms': float(avg_latency)
                }
        
        return tier_metrics
    
    def analyze_confidence_distribution(self, val_df: pd.DataFrame) -> Dict:
        """Analyze confidence score distribution."""
        confidence_ranges = {
            'very_high (>0.9)': (val_df['confidence'] > 0.9).sum(),
            'high (0.7-0.9)': ((val_df['confidence'] >= 0.7) & (val_df['confidence'] <= 0.9)).sum(),
            'medium (0.5-0.7)': ((val_df['confidence'] >= 0.5) & (val_df['confidence'] < 0.7)).sum(),
            'low (<0.5)': (val_df['confidence'] < 0.5).sum()
        }
        
        # Calculate accuracy by confidence range
        accuracy_by_confidence = {}
        for range_name, condition in [
            ('very_high', val_df['confidence'] > 0.9),
            ('high', (val_df['confidence'] >= 0.7) & (val_df['confidence'] <= 0.9)),
            ('medium', (val_df['confidence'] >= 0.5) & (val_df['confidence'] < 0.7)),
            ('low', val_df['confidence'] < 0.5)
        ]:
            subset = val_df[condition]
            if len(subset) > 0:
                accuracy = (subset['intent'] == subset['predicted_intent']).mean()
                accuracy_by_confidence[range_name] = float(accuracy)
        
        return {
            'distribution': {k: int(v) for k, v in confidence_ranges.items()},
            'accuracy_by_range': accuracy_by_confidence,
            'mean_confidence': float(val_df['confidence'].mean()),
            'median_confidence': float(val_df['confidence'].median()),
            'std_confidence': float(val_df['confidence'].std())
        }
    
    def analyze_latency_distribution(self, val_df: pd.DataFrame) -> Dict:
        """Analyze latency distribution."""
        latencies = val_df['latency_ms'].values
        
        return {
            'mean_ms': float(np.mean(latencies)),
            'median_ms': float(np.median(latencies)),
            'std_ms': float(np.std(latencies)),
            'min_ms': float(np.min(latencies)),
            'max_ms': float(np.max(latencies)),
            'p25_ms': float(np.percentile(latencies, 25)),
            'p50_ms': float(np.percentile(latencies, 50)),
            'p75_ms': float(np.percentile(latencies, 75)),
            'p90_ms': float(np.percentile(latencies, 90)),
            'p95_ms': float(np.percentile(latencies, 95)),
            'p99_ms': float(np.percentile(latencies, 99))
        }
    
    def generate_confusion_matrix_data(self, val_df: pd.DataFrame) -> Dict:
        """Generate confusion matrix data."""
        intents = sorted(val_df['intent'].unique())
        cm = confusion_matrix(val_df['intent'], val_df['predicted_intent'], labels=intents)
        
        return {
            'classes': intents,
            'matrix': cm.tolist()
        }
    
    def analyze_error_patterns(self, val_df: pd.DataFrame) -> Dict:
        """Analyze common error patterns."""
        errors_df = val_df[val_df['intent'] != val_df['predicted_intent']].copy()
        
        if len(errors_df) == 0:
            return {'total_errors': 0, 'error_patterns': {}}
        
        # Most common confusion pairs
        error_pairs = []
        for _, row in errors_df.iterrows():
            error_pairs.append(f"{row['intent']} -> {row['predicted_intent']}")
        
        error_counter = Counter(error_pairs)
        
        # Errors by confidence level
        high_conf_errors = (errors_df['confidence'] > 0.8).sum()
        low_conf_errors = (errors_df['confidence'] < 0.5).sum()
        
        return {
            'total_errors': int(len(errors_df)),
            'error_rate': float(len(errors_df) / len(val_df)),
            'most_common_errors': dict(error_counter.most_common(5)),
            'high_confidence_errors': int(high_conf_errors),
            'low_confidence_errors': int(low_conf_errors)
        }
    
    def generate_comprehensive_report(self) -> Dict:
        """Generate comprehensive performance report."""
        print("="*60)
        print("OFFLINE NLP MODEL PERFORMANCE METRICS")
        print("="*60)
        
        # Run validation
        val_df = self.run_validation()
        
        # Calculate all metrics
        report = {
            'metadata': {
                'total_samples': int(len(val_df)),
                'intent_classes': int(len(val_df['intent'].unique())),
                'timestamp': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')
            },
            'core_metrics': self.calculate_core_metrics(val_df),
            'per_class_metrics': self.calculate_per_class_metrics(val_df),
            'language_analysis': self.analyze_by_language(val_df),
            'tier_analysis': self.analyze_by_inference_tier(val_df),
            'confidence_analysis': self.analyze_confidence_distribution(val_df),
            'latency_analysis': self.analyze_latency_distribution(val_df),
            'confusion_matrix': self.generate_confusion_matrix_data(val_df),
            'error_analysis': self.analyze_error_patterns(val_df)
        }
        
        return report
    
    def save_report(self, report: Dict, output_path: str = 'nlp_performance_metrics.json'):
        """Save performance report to JSON file."""
        output_file = Path(__file__).parent / output_path
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        print(f"💾 Performance metrics saved to {output_file}")
    
    def print_summary(self, report: Dict):
        """Print human-readable summary."""
        print("\n" + "="*60)
        print("PERFORMANCE METRICS SUMMARY")
        print("="*60)
        
        print(f"\nTotal Samples: {report['metadata']['total_samples']}")
        print(f"Intent Classes: {report['metadata']['intent_classes']}")
        
        print("\n--- Core Metrics ---")
        core = report['core_metrics']
        print(f"Accuracy: {core['accuracy']:.4f}")
        print(f"Precision (Macro): {core['precision_macro']:.4f}")
        print(f"Recall (Macro): {core['recall_macro']:.4f}")
        print(f"F1-Score (Macro): {core['f1_macro']:.4f}")
        
        print("\n--- Language Performance ---")
        for lang, metrics in report['language_analysis'].items():
            print(f"{lang}: {metrics['accuracy']:.4f} (n={metrics['samples']})")
        
        print("\n--- Inference Tier Performance ---")
        for tier, metrics in report['tier_analysis'].items():
            print(f"{tier}: {metrics['accuracy']:.4f} (n={metrics['count']}, {metrics['avg_latency_ms']:.2f}ms)")
        
        print("\n--- Latency Analysis ---")
        latency = report['latency_analysis']
        print(f"Mean: {latency['mean_ms']:.2f} ms")
        print(f"Median: {latency['median_ms']:.2f} ms")
        print(f"P95: {latency['p95_ms']:.2f} ms")
        print(f"P99: {latency['p99_ms']:.2f} ms")
        
        print("\n--- Error Analysis ---")
        errors = report['error_analysis']
        print(f"Total Errors: {errors['total_errors']} ({errors['error_rate']:.4%})")
        
        print("="*60)


def main():
    """Main entry point for metrics generation."""
    generator = NLPMetricsGenerator()
    
    # Generate comprehensive report
    report = generator.generate_comprehensive_report()
    
    # Save report
    generator.save_report(report)
    
    # Print summary
    generator.print_summary(report)
    
    print("\n✅ Performance metrics generation complete!")


if __name__ == '__main__':
    main()
