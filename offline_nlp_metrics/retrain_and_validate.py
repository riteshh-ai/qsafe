"""
Retrain Model with New Validation Split

This script creates a fresh train/validation split, retrains the model,
and evaluates performance to validate the consistency of metrics.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import sys
import json
from sklearn.model_selection import train_test_split

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.model import ModelTrainer
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class RetrainValidator:
    """Retrain model with new validation split for validation testing."""
    
    def __init__(self, project_root: Path = None):
        """Initialize retrain validator."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.datasets_dir = project_root / "datasets"
        self.metrics_dir = Path(__file__).parent
        
    def create_new_split(self, test_size: float = 0.2, random_state: int = 42) -> pd.DataFrame:
        """Create fresh train/validation split."""
        print("Creating new train/validation split...")
        
        # Load original dataset
        dataset_path = self.datasets_dir / "training_dataset.csv"
        df = pd.read_csv(dataset_path, encoding='utf-8')
        
        # Remove existing split column
        if 'split' in df.columns:
            df = df.drop(columns=['split'])
        
        # Create new split
        train_df, val_df = train_test_split(
            df, 
            test_size=test_size, 
            random_state=random_state,
            stratify=df['intent']  # Stratified split
        )
        
        # Add split column
        train_df['split'] = 'train'
        val_df['split'] = 'validation'
        
        # Combine
        new_df = pd.concat([train_df, val_df], ignore_index=True)
        
        # Save new dataset
        new_dataset_path = self.metrics_dir / 'new_training_dataset.csv'
        new_df.to_csv(new_dataset_path, index=False, encoding='utf-8')
        
        print(f"✓ New split created: {len(train_df)} train, {len(val_df)} validation")
        print(f"✓ Saved to {new_dataset_path}")
        
        return new_df
    
    def retrain_model(self, dataset_path: Path) -> dict:
        """Retrain model with new dataset."""
        print("\nRetraining model with new dataset...")
        
        # Temporarily replace the training dataset
        original_dataset = self.datasets_dir / "training_dataset.csv"
        backup_dataset = self.datasets_dir / "training_dataset_backup.csv"
        
        # Backup original
        import shutil
        shutil.copy(original_dataset, backup_dataset)
        
        # Copy new dataset
        shutil.copy(dataset_path, original_dataset)
        
        try:
            # Train new model
            trainer = ModelTrainer()
            metrics = trainer.train()
            
            print("✓ Model retrained successfully")
            return metrics
        finally:
            # Restore original dataset
            shutil.copy(backup_dataset, original_dataset)
            backup_dataset.unlink()
    
    def evaluate_new_model(self) -> dict:
        """Evaluate retrained model on new validation set."""
        print("\nEvaluating retrained model...")
        
        # Load new dataset
        new_dataset_path = self.metrics_dir / 'new_training_dataset.csv'
        df = pd.read_csv(new_dataset_path, encoding='utf-8')
        val_df = df[df['split'] == 'validation'].copy()
        
        # Get engine (will use newly trained model)
        engine = get_engine(self.project_root)
        
        # Run inference
        texts = val_df['text'].tolist()
        results = [engine.predict(text) for text in texts]
        
        # Calculate metrics
        y_true = val_df['intent'].values
        y_pred = [r['intent'] for r in results]
        
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
        
        accuracy = accuracy_score(y_true, y_pred)
        precision_macro = precision_score(y_true, y_pred, average='macro', zero_division=0)
        recall_macro = recall_score(y_true, y_pred, average='macro', zero_division=0)
        f1_macro = f1_score(y_true, y_pred, average='macro', zero_division=0)
        
        # Count errors
        errors = sum(1 for true, pred in zip(y_true, y_pred) if true != pred)
        
        evaluation = {
            'total_samples': len(val_df),
            'correct_predictions': int((y_true == y_pred).sum()),
            ' errors': int(errors),
            'accuracy': float(accuracy),
            'precision_macro': float(precision_macro),
            'recall_macro': float(recall_macro),
            'f1_macro': float(f1_macro)
        }
        
        print(f"✓ Evaluation complete: {accuracy:.4f} accuracy")
        return evaluation
    
    def compare_with_original(self, new_metrics: dict, original_metrics: dict) -> dict:
        """Compare new metrics with original."""
        comparison = {
            'original_accuracy': original_metrics['core_metrics']['accuracy'],
            'new_accuracy': new_metrics['accuracy'],
            'accuracy_diff': new_metrics['accuracy'] - original_metrics['core_metrics']['accuracy'],
            'original_precision': original_metrics['core_metrics']['precision_macro'],
            'new_precision': new_metrics['precision_macro'],
            'precision_diff': new_metrics['precision_macro'] - original_metrics['core_metrics']['precision_macro'],
            'original_recall': original_metrics['core_metrics']['recall_macro'],
            'new_recall': new_metrics['recall_macro'],
            'recall_diff': new_metrics['recall_macro'] - original_metrics['core_metrics']['recall_macro'],
            'original_f1': original_metrics['core_metrics']['f1_macro'],
            'new_f1': new_metrics['f1_macro'],
            'f1_diff': new_metrics['f1_macro'] - original_metrics['core_metrics']['f1_macro']
        }
        return comparison
    
    def run_validation_test(self) -> dict:
        """Run complete retrain validation test."""
        print("="*60)
        print("RETRAIN VALIDATION TEST")
        print("="*60)
        
        # Load original metrics for comparison
        original_metrics_path = self.metrics_dir / 'nlp_performance_metrics.json'
        with open(original_metrics_path, 'r') as f:
            original_metrics = json.load(f)
        
        # Create new split
        new_df = self.create_new_split(test_size=0.2, random_state=123)  # Different random state
        
        # Save new dataset
        new_dataset_path = self.metrics_dir / 'new_training_dataset.csv'
        
        # Retrain model
        training_metrics = self.retrain_model(new_dataset_path)
        
        # Evaluate
        evaluation_metrics = self.evaluate_new_model()
        
        # Compare
        comparison = self.compare_with_original(evaluation_metrics, original_metrics)
        
        results = {
            'original_validation_size': original_metrics['metadata']['total_samples'],
            'new_validation_size': evaluation_metrics['total_samples'],
            'training_metrics': training_metrics,
            'evaluation_metrics': evaluation_metrics,
            'comparison': comparison,
            'conclusion': 'STABLE' if abs(comparison['accuracy_diff']) < 0.01 else 'UNSTABLE'
        }
        
        # Save results
        results_path = self.metrics_dir / 'retrain_validation_results.json'
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"💾 Results saved to {results_path}")
        
        return results
    
    def print_summary(self, results: dict):
        """Print validation test summary."""
        print("\n" + "="*60)
        print("RETRAIN VALIDATION SUMMARY")
        print("="*60)
        
        print(f"\nOriginal Validation: {results['original_validation_size']} samples")
        print(f"New Validation: {results['new_validation_size']} samples")
        
        print("\n--- Accuracy Comparison ---")
        comp = results['comparison']
        print(f"Original: {comp['original_accuracy']:.4f}")
        print(f"New: {comp['new_accuracy']:.4f}")
        print(f"Difference: {comp['accuracy_diff']:+.4f}")
        
        print("\n--- Full Metrics Comparison ---")
        print(f"Precision: {comp['original_precision']:.4f} → {comp['new_precision']:.4f} ({comp['precision_diff']:+.4f})")
        print(f"Recall: {comp['original_recall']:.4f} → {comp['new_recall']:.4f} ({comp['recall_diff']:+.4f})")
        print(f"F1-Score: {comp['original_f1']:.4f} → {comp['new_f1']:.4f} ({comp['f1_diff']:+.4f})")
        
        print(f"\n--- Conclusion ---")
        print(f"Model Performance: {results['conclusion']}")
        
        if results['conclusion'] == 'STABLE':
            print("✅ Metrics remain stable - original accuracy is validated")
        else:
            print("⚠️ Metrics changed significantly - investigate further")
        
        print("="*60)


def main():
    """Main entry point."""
    validator = RetrainValidator()
    results = validator.run_validation_test()
    validator.print_summary(results)
    print("\n✅ Retrain validation test complete!")


if __name__ == '__main__':
    main()
