"""
Training Curves Generator for QSAFE Offline NLP Engine

This script generates accuracy and loss curves for the NLP model by training
with incremental iterations and capturing metrics at each step.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
import sys
import time
import json
from typing import Dict, List, Tuple

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.model import ModelTrainer
    from src.preprocessor import TextPreprocessor
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.pipeline import FeatureUnion
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import log_loss, accuracy_score
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class TrainingCurvesGenerator:
    """Generate training curves for the NLP model."""
    
    def __init__(self, project_root: Path = None):
        """Initialize generator with model trainer."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.trainer = ModelTrainer()
        self.preprocessor = TextPreprocessor()
        
    def load_data(self) -> Tuple:
        """Load and prepare training data."""
        print("Loading training data...")
        X_train, y_train, X_val, y_val = self.trainer.load_dataset()
        return X_train, y_train, X_val, y_val
    
    def build_vectorizer(self) -> FeatureUnion:
        """Build and fit the feature vectorizer."""
        print("Building vectorizer...")
        vectorizer = self.trainer.build_vectorizer()
        return vectorizer
    
    def generate_learning_curves(self, max_iter: int = 1000, step_size: int = 50) -> Dict:
        """
        Generate learning curves by training incrementally.
        
        Args:
            max_iter: Maximum iterations for Logistic Regression
            step_size: Step size for capturing metrics
            
        Returns:
            Dictionary containing training history
        """
        print(f"\nGenerating learning curves (max_iter={max_iter}, step_size={step_size})...")
        
        # Load data
        X_train, y_train, X_val, y_val = self.load_data()
        
        # Build and fit vectorizer
        vectorizer = self.build_vectorizer()
        X_train_vec = vectorizer.fit_transform(X_train)
        X_val_vec = vectorizer.transform(X_val)
        
        # Initialize model
        model = LogisticRegression(
            C=5.0,
            max_iter=1,  # We'll control iterations manually
            random_state=42,
            solver='lbfgs',
            warm_start=True  # Allow incremental training
        )
        
        # Storage for metrics
        history = {
            'iterations': [],
            'train_accuracy': [],
            'val_accuracy': [],
            'train_loss': [],
            'val_loss': []
        }
        
        # Get unique classes for log_loss
        classes = np.unique(y_train)
        
        print("Training incrementally and capturing metrics...")
        for iteration in range(step_size, max_iter + 1, step_size):
            # Set max_iter for this step
            model.max_iter = iteration
            
            # Train model
            start_time = time.time()
            model.fit(X_train_vec, y_train)
            train_time = time.time() - start_time
            
            # Make predictions
            y_train_pred = model.predict(X_train_vec)
            y_val_pred = model.predict(X_val_vec)
            
            # Get probabilities for loss calculation
            y_train_proba = model.predict_proba(X_train_vec)
            y_val_proba = model.predict_proba(X_val_vec)
            
            # Calculate metrics
            train_acc = accuracy_score(y_train, y_train_pred)
            val_acc = accuracy_score(y_val, y_val_pred)
            
            try:
                train_loss = log_loss(y_train, y_train_proba, labels=classes)
                val_loss = log_loss(y_val, y_val_proba, labels=classes)
            except:
                # Fallback if log_loss fails
                train_loss = 1.0 - train_acc
                val_loss = 1.0 - val_acc
            
            # Store metrics
            history['iterations'].append(iteration)
            history['train_accuracy'].append(train_acc)
            history['val_accuracy'].append(val_acc)
            history['train_loss'].append(train_loss)
            history['val_loss'].append(val_loss)
            
            print(f"  Iteration {iteration:4d}: Train Acc={train_acc:.4f}, Val Acc={val_acc:.4f}, "
                  f"Train Loss={train_loss:.4f}, Val Loss={val_loss:.4f}, Time={train_time:.2f}s")
        
        return history
    
    def plot_learning_curves(self, history: Dict, save_path: str = 'training_curves.png'):
        """
        Plot and save learning curves.
        
        Args:
            history: Training history dictionary
            save_path: Path to save the plot
        """
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        iterations = history['iterations']
        
        # Plot Accuracy
        axes[0].plot(iterations, history['train_accuracy'], 'b-', label='Training Accuracy', linewidth=2)
        axes[0].plot(iterations, history['val_accuracy'], 'r-', label='Validation Accuracy', linewidth=2)
        axes[0].set_xlabel('Iterations', fontsize=12)
        axes[0].set_ylabel('Accuracy', fontsize=12)
        axes[0].set_title('Model Accuracy During Training', fontsize=14, fontweight='bold')
        axes[0].legend(fontsize=10)
        axes[0].grid(True, alpha=0.3)
        axes[0].set_ylim([0.8, 1.0])
        
        # Plot Loss
        axes[1].plot(iterations, history['train_loss'], 'b-', label='Training Loss', linewidth=2)
        axes[1].plot(iterations, history['val_loss'], 'r-', label='Validation Loss', linewidth=2)
        axes[1].set_xlabel('Iterations', fontsize=12)
        axes[1].set_ylabel('Log Loss', fontsize=12)
        axes[1].set_title('Model Loss During Training', fontsize=14, fontweight='bold')
        axes[1].legend(fontsize=10)
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        # Save figure
        output_path = Path(__file__).parent / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"\n📊 Learning curves saved to {output_path}")
        
        plt.close()
    
    def plot_combined_metrics(self, history: Dict, save_path: str = 'combined_metrics.png'):
        """
        Plot combined metrics on a single graph.
        
        Args:
            history: Training history dictionary
            save_path: Path to save the plot
        """
        fig, ax1 = plt.subplots(figsize=(12, 6))
        
        iterations = history['iterations']
        
        # Plot accuracy on left axis
        color1 = 'tab:blue'
        ax1.set_xlabel('Training Iterations', fontsize=12)
        ax1.set_ylabel('Accuracy', color=color1, fontsize=12)
        ax1.plot(iterations, history['train_accuracy'], color=color1, linestyle='-', 
                label='Training Accuracy', linewidth=2, alpha=0.7)
        ax1.plot(iterations, history['val_accuracy'], color=color1, linestyle='--', 
                label='Validation Accuracy', linewidth=2, alpha=0.7)
        ax1.tick_params(axis='y', labelcolor=color1)
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim([0.8, 1.0])
        
        # Create second axis for loss
        ax2 = ax1.twinx()
        color2 = 'tab:red'
        ax2.set_ylabel('Log Loss', color=color2, fontsize=12)
        ax2.plot(iterations, history['train_loss'], color=color2, linestyle='-', 
                label='Training Loss', linewidth=2, alpha=0.7)
        ax2.plot(iterations, history['val_loss'], color=color2, linestyle='--', 
                label='Validation Loss', linewidth=2, alpha=0.7)
        ax2.tick_params(axis='y', labelcolor=color2)
        
        # Combine legends
        lines1, labels1 = ax1.get_legend_handles_labels()
        lines2, labels2 = ax2.get_legend_handles_labels()
        ax1.legend(lines1 + lines2, labels1 + labels2, loc='center right', fontsize=10)
        
        plt.title('QSAFE NLP Model: Training Progress Metrics', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        # Save figure
        output_path = Path(__file__).parent / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Combined metrics plot saved to {output_path}")
        
        plt.close()
    
    def save_training_history(self, history: Dict, save_path: str = 'training_history.json'):
        """Save training history to JSON file."""
        # Convert numpy types to Python types for JSON serialization
        serializable_history = {}
        for key, value in history.items():
            if isinstance(value, list):
                serializable_history[key] = [int(x) if isinstance(x, (np.integer, np.int64)) else float(x) if isinstance(x, (np.floating, np.float64)) else x for x in value]
            else:
                serializable_history[key] = value
        
        output_path = Path(__file__).parent / save_path
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(serializable_history, f, indent=2)
        print(f"💾 Training history saved to {output_path}")
    
    def generate_final_comparison(self, history: Dict) -> Dict:
        """Generate final comparison metrics."""
        final_metrics = {
            'final_train_accuracy': float(history['train_accuracy'][-1]),
            'final_val_accuracy': float(history['val_accuracy'][-1]),
            'final_train_loss': float(history['train_loss'][-1]),
            'final_val_loss': float(history['val_loss'][-1]),
            'best_val_accuracy': float(max(history['val_accuracy'])),
            'best_val_accuracy_iteration': int(history['iterations'][np.argmax(history['val_accuracy'])]),
            'convergence_point': int(self._find_convergence_point(history)),
            'total_iterations': int(history['iterations'][-1])
        }
        return final_metrics
    
    def _find_convergence_point(self, history: Dict, threshold: float = 0.001) -> int:
        """Find the iteration where validation accuracy converges."""
        val_acc = history['val_accuracy']
        for i in range(10, len(val_acc)):
            # Check if accuracy hasn't changed much in last 10 iterations
            recent_change = max(val_acc[i-10:i]) - min(val_acc[i-10:i])
            if recent_change < threshold:
                return history['iterations'][i]
        return history['iterations'][-1]


def main():
    """Main entry point for generating training curves."""
    print("="*60)
    print("QSAFE NLP Training Curves Generator")
    print("="*60)
    
    generator = TrainingCurvesGenerator()
    
    # Generate learning curves
    history = generator.generate_learning_curves(max_iter=1000, step_size=50)
    
    # Save training history
    generator.save_training_history(history)
    
    # Generate plots
    generator.plot_learning_curves(history, 'training_curves.png')
    generator.plot_combined_metrics(history, 'combined_metrics.png')
    
    # Generate final comparison
    final_metrics = generator.generate_final_comparison(history)
    
    print("\n" + "="*60)
    print("FINAL TRAINING METRICS")
    print("="*60)
    print(f"Final Training Accuracy: {final_metrics['final_train_accuracy']:.4f}")
    print(f"Final Validation Accuracy: {final_metrics['final_val_accuracy']:.4f}")
    print(f"Best Validation Accuracy: {final_metrics['best_val_accuracy']:.4f} (at iteration {final_metrics['best_val_accuracy_iteration']})")
    print(f"Final Training Loss: {final_metrics['final_train_loss']:.4f}")
    print(f"Final Validation Loss: {final_metrics['final_val_loss']:.4f}")
    print(f"Convergence Point: ~iteration {final_metrics['convergence_point']}")
    print(f"Total Training Iterations: {final_metrics['total_iterations']}")
    print("="*60)
    
    # Save final metrics
    output_path = Path(__file__).parent / 'final_metrics.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_metrics, f, indent=2)
    print(f"💾 Final metrics saved to {output_path}")
    
    print("\n✅ Training curves generation complete!")


if __name__ == '__main__':
    main()
