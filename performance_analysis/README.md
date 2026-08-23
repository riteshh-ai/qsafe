# QSAFE Offline NLP Performance Analysis

This folder contains datasets for generating performance matrices and metrics for the offline NLP engine.

## Datasets Included

### Core Training Data
- **training_dataset.csv** (379 KB) - Primary dataset with 3,673 samples including train/validation splits
  - Columns: text, intent, split
  - Used for model training and validation

### Language-Specific Datasets
- **english_dataset.csv** (61 KB) - English-only training samples
- **nepali_dataset.csv** (117 KB) - Devanagari Nepali samples
- **mixed_dataset.csv** (67 KB) - Code-mixed and Romanized Nepali samples

### Reference Data
- **keywords.csv** (22 KB) - Exact-match keyword dictionary for Tier 1 classification
  - Columns: keyword, intent, language
- **labelled_dataset.csv** (347 KB) - Fully labelled dataset with intent classifications
- **intents.md** - Documentation of 25 intent classes and their descriptions

## Performance Metrics That Can Be Generated

### Model Performance Metrics
1. **Accuracy** - Overall classification accuracy
2. **Precision** - Per-class precision scores
3. **Recall** - Per-class recall scores
4. **F1-Score** - Harmonic mean of precision and recall
5. **Confusion Matrix** - Cross-class prediction analysis

### Language-Specific Performance
- English-only accuracy
- Devanagari Nepali accuracy
- Romanized Nepali accuracy
- Code-mixed input accuracy

### Tier-Based Performance Analysis
- Tier 1 (Keyword match) - Accuracy and coverage
- Tier 2 (ML classification) - Confidence distribution
- Tier 3 (Fallback) - Fallback rate analysis

### Latency & Performance
- Inference latency per query
- Tier-specific latency breakdown
- Memory usage analysis

### Intent Class Distribution
- Class balance analysis
- Per-class sample counts
- Minority class performance

## Benchmark Testing

### Run Comprehensive Benchmark
```bash
# Install psutil dependency
pip install psutil>=5.9.0

# Run comprehensive benchmark suite
python benchmark_test.py
```

This will:
- Test single inference latency (1,000 iterations)
- Measure batch inference performance (various batch sizes)
- Benchmark sustained throughput (10-second test)
- Test concurrent request handling (multi-threaded)
- Analyze input size scaling
- Measure tier-specific performance
- Evaluate language-specific performance
- Check memory usage and leaks

### Benchmark Results
The benchmark generates:
- **`benchmark_results.json`** - Detailed raw benchmark data
- **`benchmark_summary.md`** - Human-readable performance analysis

### Key Benchmark Metrics
- **Mean Latency**: ~5.94 ms
- **Throughput**: 166+ queries/second
- **Memory Usage**: 174 MB steady state
- **P95 Latency**: ~8.81 ms
- **Concurrent Performance**: 145+ QPS under load

## Training Curves Visualization

### Option 1: Quick Learning Curves (Recommended)
```bash
# Install matplotlib dependency
pip install matplotlib>=3.7.0

# Generate learning curves using existing model artifacts (fast)
python quick_curves.py
```

This will:
- Use existing trained model artifacts (no retraining needed)
- Evaluate model on progressively larger training subsets
- Generate learning curves showing performance vs training size
- Generate two visualization files:
  - `learning_curves.png` - Side-by-side accuracy and loss plots
  - `combined_learning_curves.png` - Combined metrics on single graph
- Save learning history to `learning_history.json`
- Save summary to `learning_summary.json`

### Option 2: Full Training Curves (Complete Retraining)
```bash
# Generate training curves with full incremental training (slower)
python generate_training_curves.py
```

This will:
- Retrain the model incrementally from 50 to 1000 iterations
- Capture training and validation accuracy/loss at each step
- Generate two visualization files:
  - `training_curves.png` - Side-by-side accuracy and loss plots
  - `combined_metrics.png` - Combined metrics on single graph
- Save training history to `training_history.json`
- Save final metrics to `final_metrics.json`

### Training Curves Output
Both scripts generate:
- **Training Accuracy Curve** - Shows model learning progress
- **Validation Accuracy Curve** - Shows generalization performance
- **Training Loss Curve** - Shows error reduction during training
- **Validation Loss Curve** - Shows error on unseen data
- **Convergence Analysis** - Identifies when the model converges
- **Best Performance Point** - Highlights optimal training point

## Usage Examples

### Generate Confusion Matrix
```python
import pandas as pd
from sklearn.metrics import confusion_matrix, classification_report

# Load validation data
df = pd.read_csv('training_dataset.csv')
val_df = df[df['split'] == 'validation']

# Generate predictions using the engine
# ... (use IntentEngine to predict)

# Generate metrics
print(classification_report(y_true, y_pred))
```

### Language-Specific Analysis
```python
# Analyze performance by language
english_data = pd.read_csv('english_dataset.csv')
nepali_data = pd.read_csv('nepali_dataset.csv')
mixed_data = pd.read_csv('mixed_dataset.csv')

# Calculate accuracy per language
# ...
```

### Keyword Coverage Analysis
```python
# Analyze keyword match coverage
keywords = pd.read_csv('keywords.csv')
training_data = pd.read_csv('training_dataset.csv')

# Calculate how many samples match keywords exactly
# ...
```

## Recommended Analysis Workflow

1. **Load training dataset** and split by train/validation
2. **Run inference** on validation set using IntentEngine
3. **Calculate core metrics** (accuracy, precision, recall, F1)
4. **Generate confusion matrix** to identify misclassifications
5. **Analyze by language** to detect performance gaps
6. **Measure latency** across different query types
7. **Document findings** in performance report

## Notes

- All datasets use UTF-8 encoding
- Intent classes follow the 25-intent taxonomy defined in intents.md
- Training dataset includes proper train/validation splits
- Keywords are used for Tier 1 exact matching in the inference engine
