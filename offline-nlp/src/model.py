"""
Phase 2: Feature Vectorization & Model Training
Hybrid TF-IDF approach: word-level (1-2 grams) + character-level (2-5 grams)
Multinomial Logistic Regression classifier with hyperparameters: C=5.0, max_iter=1000
"""
import os
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
import time
from .preprocessor import TextPreprocessor


class ModelTrainer:
    """
    Trains intent classification model with hybrid TF-IDF vectorization.
    
    Architecture:
    - FeatureUnion combining:
      1. Word-level TF-IDF (1-2 grams, max 5,000 features)
      2. Character-level TF-IDF (2-5 grams, max 10,000 features)
    - Multinomial Logistic Regression (C=5.0, max_iter=1000)
    
    Outputs:
    - models/vectorizer.joblib (~0.27 MB, compress=3)
    - models/model.joblib (~1.88 MB, compress=3)
    """
    
    def __init__(self):
        self.vectorizer = None
        self.model = None
        self.preprocessor = TextPreprocessor()
        
        # Define paths (relative to project root)
        self.project_root = Path(__file__).parent.parent
        self.datasets_dir = self.project_root / "datasets"
        self.models_dir = self.project_root / "models"
        
        # Ensure models directory exists
        self.models_dir.mkdir(exist_ok=True)
    
    def load_dataset(self) -> tuple:
        """
        Load and split training dataset.
        
        Returns:
            (X_train, y_train, X_val, y_val): Training and validation sets
        """
        dataset_path = self.datasets_dir / "training_dataset.csv"
        
        if not dataset_path.exists():
            raise FileNotFoundError(f"Dataset not found: {dataset_path}")
        
        df = pd.read_csv(dataset_path)
        
        # Validate required columns
        required_cols = ['text', 'intent', 'split']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"Dataset must contain columns: {required_cols}")
        
        # Preprocess text
        df['text'] = df['text'].apply(self.preprocessor.clean)
        
        # Remove empty texts
        df = df[df['text'].str.len() > 0].reset_index(drop=True)
        
        # Split into train and validation
        train_df = df[df['split'] == 'train']
        val_df = df[df['split'] == 'validation']
        
        X_train = train_df['text'].values
        y_train = train_df['intent'].values
        X_val = val_df['text'].values
        y_val = val_df['intent'].values
        
        print(f"✓ Dataset loaded: {len(X_train)} train, {len(X_val)} validation samples")
        print(f"✓ Intent classes: {len(np.unique(y_train))} unique intents")
        
        return X_train, y_train, X_val, y_val
    
    def build_vectorizer(self) -> FeatureUnion:
        """
        Build hybrid FeatureUnion combining word and character-level TF-IDF.
        
        Returns:
            sklearn.pipeline.FeatureUnion with:
            - TfidfVectorizer for word n-grams (1-2, max_features=5000)
            - TfidfVectorizer for char n-grams (2-5, max_features=10000)
        """
        # Word-level TF-IDF (1-2 grams)
        word_tfidf = TfidfVectorizer(
            analyzer='word',
            ngram_range=(1, 2),
            max_features=5000,
            lowercase=False,  # Already lowercased in preprocessing
            stop_words=None   # Custom intent domain, no generic stop words
        )
        
        # Character-level TF-IDF (2-5 grams)
        char_tfidf = TfidfVectorizer(
            analyzer='char',
            ngram_range=(2, 5),
            max_features=10000,
            lowercase=False
        )
        
        # Combine into FeatureUnion
        feature_union = FeatureUnion([
            ('word_tfidf', word_tfidf),
            ('char_tfidf', char_tfidf)
        ])
        
        return feature_union
    
    def train(self) -> dict:
        """
        Train the complete pipeline: vectorization + logistic regression.
        
        Returns:
            dict with performance metrics (accuracy, precision, recall, F1)
        """
        print("\n📊 Loading dataset...")
        X_train, y_train, X_val, y_val = self.load_dataset()
        
        print("\n🔧 Building feature vectorizer...")
        self.vectorizer = self.build_vectorizer()
        
        print("📈 Fitting vectorizer and extracting features...")
        start_time = time.time()
        X_train_vec = self.vectorizer.fit_transform(X_train)
        fit_time = time.time() - start_time
        
        print(f"✓ Vectorizer fitted in {fit_time:.2f}s")
        print(f"✓ Feature matrix shape: {X_train_vec.shape} (2,927 train × 15,000 features)")
        
        print("\n🤖 Training Logistic Regression classifier...")
        self.model = LogisticRegression(
            C=5.0,
            max_iter=1000,
            random_state=42,
            solver='lbfgs'
        )
        
        start_time = time.time()
        self.model.fit(X_train_vec, y_train)
        train_time = time.time() - start_time
        print(f"✓ Model trained in {train_time:.2f}s")
        
        # Evaluate on validation set
        print("\n🔍 Evaluating on validation set...")
        X_val_vec = self.vectorizer.transform(X_val)
        y_pred = self.model.predict(X_val_vec)
        y_pred_proba = self.model.predict_proba(X_val_vec)
        
        accuracy = accuracy_score(y_val, y_pred)
        precision = precision_score(y_val, y_pred, average='macro', zero_division=0)
        recall = recall_score(y_val, y_pred, average='macro', zero_division=0)
        f1 = f1_score(y_val, y_pred, average='macro', zero_division=0)
        
        print(f"\n📊 Validation Metrics:")
        print(f"   Accuracy:  {accuracy*100:.2f}%")
        print(f"   Precision: {precision*100:.2f}%")
        print(f"   Recall:    {recall*100:.2f}%")
        print(f"   F1-Score:  {f1*100:.2f}%")
        
        # Save models
        self._save_artifacts()
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'num_samples_train': len(X_train),
            'num_samples_val': len(X_val),
            'num_features': X_train_vec.shape[1]
        }
    
    def _save_artifacts(self):
        """
        Export trained vectorizer and model to models/ directory using joblib compression.
        
        Files:
        - models/vectorizer.joblib (~0.27 MB)
        - models/model.joblib (~1.88 MB)
        """
        print("\n💾 Saving artifacts...")
        
        vectorizer_path = self.models_dir / "vectorizer.joblib"
        model_path = self.models_dir / "model.joblib"
        
        # Save with compression level 3
        joblib.dump(self.vectorizer, vectorizer_path, compress=3)
        joblib.dump(self.model, model_path, compress=3)
        
        vec_size = vectorizer_path.stat().st_size / (1024 * 1024)
        model_size = model_path.stat().st_size / (1024 * 1024)
        
        print(f"   ✓ vectorizer.joblib: {vec_size:.2f} MB")
        print(f"   ✓ model.joblib: {model_size:.2f} MB")
        print(f"   Path: {self.models_dir}")
    
    @staticmethod
    def load_model(project_root: Path = None):
        """
        Load pre-trained vectorizer and model from artifacts.
        
        Args:
            project_root: Path to project root (auto-detected if None)
            
        Returns:
            tuple: (vectorizer, model)
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent
        
        models_dir = project_root / "models"
        vectorizer_path = models_dir / "vectorizer.joblib"
        model_path = models_dir / "model.joblib"
        
        if not vectorizer_path.exists() or not model_path.exists():
            raise FileNotFoundError(f"Model artifacts not found in {models_dir}")
        
        vectorizer = joblib.load(vectorizer_path)
        model = joblib.load(model_path)
        
        return vectorizer, model
