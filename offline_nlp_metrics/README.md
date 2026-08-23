# Offline NLP Model Performance Metrics

This folder contains comprehensive performance analysis specifically for the QSAFE Offline NLP Engine.

## Folder Contents

### Datasets
- **training_dataset.csv** - Main dataset with train/validation splits (746 validation samples)
- **keywords.csv** - Keyword dictionary for Tier 1 classification
- **intents.md** - Documentation of 25 intent classes

### Analysis Scripts
- **generate_nlp_metrics.py** - Comprehensive metrics generation script

### Generated Reports
- **nlp_performance_metrics.json** - Detailed performance metrics (JSON format)

## Performance Summary

### Overall Performance
- **Accuracy**: 99.73%
- **Precision (Macro)**: 99.72%
- **Recall (Macro)**: 99.70%
- **F1-Score (Macro)**: 99.71%
- **Error Rate**: 0.27% (2 errors out of 746 samples)

### Language Performance
- **English**: 99.80% accuracy (511 samples)
- **Devanagari Nepali**: 99.57% accuracy (235 samples)

### Inference Tier Performance
- **Keyword Tier**: 100% accuracy (17 samples, 0.05ms latency)
- **Fuzzy Tier**: 100% accuracy (25 samples, 1.36ms latency)
- **ML Tier**: 100% accuracy (702 samples, 3.60ms latency)
- **Fallback**: 0% accuracy (2 samples, 3.38ms latency) - Expected for unclear inputs

### Latency Performance
- **Mean**: 3.44 ms
- **Median**: 3.37 ms
- **P95**: 5.12 ms
- **P99**: 6.51 ms

## Usage

### Generate Performance Metrics
```bash
cd offline_nlp_metrics
python generate_nlp_metrics.py
```

This will:
1. Load validation dataset (746 samples)
2. Run inference using the trained NLP engine
3. Calculate comprehensive performance metrics
4. Save results to `nlp_performance_metrics.json`
5. Print summary to console

## Metrics Included

### Core Classification Metrics
- Overall accuracy
- Precision (macro and weighted averages)
- Recall (macro and weighted averages)
- F1-score (macro and weighted averages)

### Per-Class Metrics
- Accuracy for each of the 25 intent classes
- Precision, recall, F1 per class
- Support (sample count) per class
- Correct predictions per class

### Language Analysis
- Performance breakdown by language (English, Devanagari, Mixed)
- Sample counts per language
- Average confidence per language
- Average latency per language

### Inference Tier Analysis
- Performance breakdown by tier (keyword, fuzzy, ML, fallback)
- Sample counts per tier
- Accuracy per tier
- Average confidence per tier
- Average latency per tier

### Confidence Analysis
- Confidence score distribution
- Accuracy by confidence range
- Mean, median, std of confidence scores

### Latency Analysis
- Comprehensive latency statistics (mean, median, percentiles)
- P25, P50, P75, P90, P95, P99 latency values

### Confusion Matrix
- Full 25x25 confusion matrix
- Cross-class prediction analysis

### Error Analysis
- Total error count and rate
- Most common error patterns
- High-confidence vs low-confidence errors

## Key Findings

### Strengths
1. **Exceptional Accuracy**: 99.73% overall accuracy is outstanding for a 25-class problem
2. **Consistent Performance**: High accuracy across all languages and inference tiers
3. **Fast Inference**: Mean latency of 3.44ms is excellent for real-time applications
4. **Effective Tiered Architecture**: Each tier performs optimally for its use case
5. **Minimal Errors**: Only 2 misclassifications out of 746 validation samples

### Performance Characteristics
- **Keyword Tier**: Extremely fast (<0.1ms) with 100% accuracy
- **Fuzzy Tier**: Very fast (~1ms) with 100% accuracy for typo-tolerant matching
- **ML Tier**: Fast (~3.6ms) with 100% accuracy for general classification
- **Low Error Rate**: 0.27% error rate indicates highly reliable predictions

## Model Assessment

### Production Readiness: ✅ EXCELLENT
The offline NLP model demonstrates production-ready performance:
- >99% accuracy across all metrics
- Sub-5ms mean latency suitable for real-time applications
- Consistent performance across languages
- Effective fallback mechanisms
- Minimal error rate

### Deployment Recommendations
The model is ready for deployment in:
- Real-time chat applications
- Emergency response systems
- Disaster assistance platforms
- Offline-first applications
- Mobile/web applications with strict latency requirements

## Technical Details

### Model Architecture
- **Approach**: Hybrid TF-IDF (word + character n-grams)
- **Classifier**: Logistic Regression (C=5.0, max_iter=1000)
- **Features**: 15,000-dimensional feature space
- **Model Size**: ~2.15 MB (compressed artifacts)

### Dataset Information
- **Training Samples**: 4,403
- **Validation Samples**: 746
- **Intent Classes**: 25
- **Languages**: English, Devanagari Nepali, Romanized Nepali

### Inference Architecture
- **Tier 1**: Exact keyword matching (<0.1ms)
- **Tier 2**: Fuzzy matching with typo tolerance (~1ms)
- **Tier 3**: ML classification (~3.6ms)
- **Tier 4**: Fallback for unclear inputs

---

**Analysis Date**: 2026-08-21  
**Model Version**: 1.0.0  
**Validation Set**: 746 samples  
**Overall Accuracy**: 99.73%
