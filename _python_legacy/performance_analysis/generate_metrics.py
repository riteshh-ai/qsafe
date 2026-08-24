"""
Performance Metrics Generator for QSAFE Offline NLP Engine

This script generates comprehensive performance matrices using the datasets
in this folder and the trained NLP model.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys
import time
import json
from collections import defaultdict
from typing import Dict, List, Tuple

# Add the offline-nlp src to path to import the engine
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
except ImportError:
    print("Error: Could not import NLP engine. Make sure offline-nlp dependencies are installed.")
    sys.exit(1)


class PerformanceAnalyzer:
    """Generate comprehensive performance metrics for the NLP engine."""
    
    def __init__(self, project_root: Path = None):
        """Initialize analyzer with NLP engine."""
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
    
    def run_inference_benchmark(self, texts: List[str]) -> Tuple[List[Dict], float]:
        """
        Run inference on a list of texts and measure total time.
        
        Returns:
            Tuple of (results list, total time in seconds)
        """
        start_time = time.time()
        results = [self.engine.predict(text) for text in texts]
        total_time = time.time() - start_time
        return results, total_time
    
    def calculate_core_metrics(self, y_true: List[str], y_pred: List[str]) -> Dict:
        """Calculate accuracy, precision, recall, F1."""
        from sklearn.metrics import accuracy_score, precision_recall_fscore_support
        
        accuracy = accuracy_score(y_true, y_pred)
        precision, recall, f1, support = precision_recall_fscore_support(
            y_true, y_pred, average='weighted', zero_division=0
        )
        
        # Per-class metrics
        per_class_precision, per_class_recall, per_class_f1, per_class_support = \
            precision_recall_fscore_support(y_true, y_pred, average=None, zero_division=0)
        
        return {
            'accuracy': accuracy,
            'precision_weighted': precision,
            'recall_weighted': recall,
            'f1_weighted': f1,
            'per_class': {
                'precision': per_class_precision.tolist(),
                'recall': per_class_recall.tolist(),
                'f1': per_class_f1.tolist(),
                'support': per_class_support.tolist()
            }
        }
    
    def analyze_by_source(self, results: List[Dict]) -> Dict:
        """Analyze performance by inference source (keyword, fuzzy, ml, fallback)."""
        source_counts = defaultdict(int)
        source_confidence = defaultdict(list)
        
        for result in results:
            source = result.get('source', 'unknown')
            source_counts[source] += 1
            source_confidence[source].append(result.get('confidence', 0.0))
        
        # Calculate average confidence per source
        source_stats = {}
        for source, confidences in source_confidence.items():
            source_stats[source] = {
                'count': source_counts[source],
                'avg_confidence': np.mean(confidences),
                'min_confidence': np.min(confidences),
                'max_confidence': np.max(confidences)
            }
        
        return source_stats
    
    def analyze_by_language(self, df: pd.DataFrame, results: List[Dict]) -> Dict:
        """Analyze performance by language type."""
        # Simple language detection based on character sets
        def detect_language(text):
            if any('\u0900' <= c <= '\u097F' for c in str(text)):
                return 'ne_dev'
            elif any(c.isalpha() and not c.isascii() for c in str(text)):
                return 'mixed'
            else:
                return 'en'
        
        df = df.copy()
        df['detected_lang'] = df['text'].apply(detect_language)
        
        lang_metrics = {}
        for lang in ['en', 'ne_dev', 'mixed']:
            lang_mask = df['detected_lang'] == lang
            if lang_mask.sum() > 0:
                lang_y_true = df[lang_mask]['intent'].tolist()
                lang_y_pred = [r['intent'] for r, mask in zip(results, lang_mask) if mask]
                
                if len(lang_y_pred) > 0:
                    from sklearn.metrics import accuracy_score
                    lang_metrics[lang] = {
                        'sample_count': len(lang_y_true),
                        'accuracy': accuracy_score(lang_y_true, lang_y_pred)
                    }
        
        return lang_metrics
    
    def generate_confusion_matrix_data(self, y_true: List[str], y_pred: List[str]) -> Dict:
        """Generate confusion matrix data for visualization."""
        from sklearn.metrics import confusion_matrix
        
        # Get unique classes
        classes = sorted(list(set(y_true + y_pred)))
        
        cm = confusion_matrix(y_true, y_pred, labels=classes)
        
        return {
            'classes': classes,
            'matrix': cm.tolist()
        }
    
    def analyze_urgency_detection(self, df: pd.DataFrame, results: List[Dict]) -> Dict:
        """Analyze urgency detection performance."""
        urgency_stats = {
            'HIGH': {'count': 0, 'correct': 0},
            'LOW': {'count': 0, 'correct': 0}
        }
        
        for result in results:
            urgency = result.get('urgency', 'LOW')
            urgency_stats[urgency]['count'] += 1
            # Note: We'd need ground truth urgency labels for accuracy calculation
            # For now, just count distribution
        
        return urgency_stats
    
    def generate_full_report(self) -> Dict:
        """Generate comprehensive performance report."""
        print("Loading validation data...")
        val_df = self.load_validation_data()
        
        print(f"Running inference on {len(val_df)} validation samples...")
        texts = val_df['text'].tolist()
        y_true = val_df['intent'].tolist()
        
        results, total_time = self.run_inference_benchmark(texts)
        y_pred = [r['intent'] for r in results]
        
        print("Calculating metrics...")
        
        # Core metrics
        core_metrics = self.calculate_core_metrics(y_true, y_pred)
        
        # Source analysis
        source_analysis = self.analyze_by_source(results)
        
        # Language analysis
        lang_analysis = self.analyze_by_language(val_df, results)
        
        # Confusion matrix
        confusion_data = self.generate_confusion_matrix_data(y_true, y_pred)
        
        # Urgency analysis
        urgency_analysis = self.analyze_urgency_detection(val_df, results)
        
        # Latency analysis
        latencies = [r.get('latency_ms', 0) for r in results]
        latency_stats = {
            'mean_ms': np.mean(latencies),
            'median_ms': np.median(latencies),
            'min_ms': np.min(latencies),
            'max_ms': np.max(latencies),
            'total_time_seconds': total_time,
            'avg_queries_per_second': len(texts) / total_time if total_time > 0 else 0
        }
        
        report = {
            'metadata': {
                'validation_samples': len(val_df),
                'intent_classes': len(set(y_true)),
                'inference_time_seconds': total_time
            },
            'core_metrics': core_metrics,
            'source_analysis': source_analysis,
            'language_analysis': lang_analysis,
            'confusion_matrix': confusion_data,
            'urgency_analysis': urgency_analysis,
            'latency_stats': latency_stats
        }
        
        return report
    
    def save_report(self, report: Dict, output_path: str = 'performance_report.json'):
        """Save performance report to JSON file."""
        output_file = Path(__file__).parent / output_path
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"Performance report saved to {output_file}")
    
    def print_summary(self, report: Dict):
        """Print a human-readable summary of the performance report."""
        print("\n" + "="*60)
        print("QSAFE OFFLINE NLP PERFORMANCE REPORT")
        print("="*60)
        
        print(f"\nValidation Samples: {report['metadata']['validation_samples']}")
        print(f"Intent Classes: {report['metadata']['intent_classes']}")
        
        print("\n--- Core Metrics ---")
        print(f"Accuracy: {report['core_metrics']['accuracy']:.4f}")
        print(f"Precision (weighted): {report['core_metrics']['precision_weighted']:.4f}")
        print(f"Recall (weighted): {report['core_metrics']['recall_weighted']:.4f}")
        print(f"F1-Score (weighted): {report['core_metrics']['f1_weighted']:.4f}")
        
        print("\n--- Inference Source Distribution ---")
        for source, stats in report['source_analysis'].items():
            print(f"{source}: {stats['count']} samples (avg conf: {stats['avg_confidence']:.3f})")
        
        print("\n--- Language Performance ---")
        for lang, stats in report['language_analysis'].items():
            print(f"{lang}: {stats['sample_count']} samples (accuracy: {stats['accuracy']:.4f})")
        
        print("\n--- Latency Statistics ---")
        print(f"Mean: {report['latency_stats']['mean_ms']:.2f} ms")
        print(f"Median: {report['latency_stats']['median_ms']:.2f} ms")
        print(f"Min: {report['latency_stats']['min_ms']:.2f} ms")
        print(f"Max: {report['latency_stats']['max_ms']:.2f} ms")
        print(f"Throughput: {report['latency_stats']['avg_queries_per_second']:.1f} queries/sec")
        
        print("\n" + "="*60)


def main():
    """Main entry point for performance analysis."""
    analyzer = PerformanceAnalyzer()
    
    print("Generating comprehensive performance report...")
    report = analyzer.generate_full_report()
    
    # Save report
    analyzer.save_report(report)
    
    # Print summary
    analyzer.print_summary(report)
    
    print("\n✅ Performance analysis complete!")


if __name__ == '__main__':
    main()
