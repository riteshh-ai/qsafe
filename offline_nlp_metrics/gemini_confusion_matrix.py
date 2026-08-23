"""
Gemini-Powered Confusion Matrix Generator

Uses Gemini AI to help generate confusion matrix analysis and insights
for the QSAFE Offline NLP model.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys
import json
import os

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
    from sklearn.metrics import confusion_matrix, classification_report
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)

try:
    import google.generativeai as genai
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Installing required packages...")
    os.system("pip install google-generativeai python-dotenv")
    import google.generativeai as genai
    from dotenv import load_dotenv
    load_dotenv()


class GeminiConfusionMatrixGenerator:
    """Generate confusion matrix with Gemini AI assistance."""
    
    def __init__(self, project_root: Path = None):
        """Initialize generator."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.engine = get_engine(project_root)
        self.preprocessor = TextPreprocessor()
        self.metrics_dir = Path(__file__).parent
        
        # Initialize Gemini
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key and api_key != 'YOUR_GEMINI_API_KEY':
            genai.configure(api_key=api_key)
            self.gemini_model = genai.GenerativeModel('gemini-2.0-flash')
            self.gemini_available = True
        else:
            print("⚠️ Gemini API key not configured. Running without AI assistance.")
            self.gemini_available = False
    
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
        df['confidence'] = [r['confidence'] for r in results]
        df['is_correct'] = df['intent'] == df['predicted_intent']
        return df
    
    def generate_confusion_matrix_data(self, df: pd.DataFrame) -> dict:
        """Generate confusion matrix and analysis data."""
        print("Generating confusion matrix data...")
        
        intents = sorted(df['intent'].unique())
        cm = confusion_matrix(df['intent'], df['predicted_intent'], labels=intents)
        
        # Calculate per-class metrics
        per_class_metrics = {}
        for i, intent in enumerate(intents):
            correct = cm[i, i]
            total = cm[i, :].sum()
            accuracy = correct / total if total > 0 else 0
            
            per_class_metrics[intent] = {
                'accuracy': float(accuracy),
                'correct': int(correct),
                'total': int(total),
                'errors': int(total - correct)
            }
        
        # Find error patterns
        error_patterns = []
        for i in range(len(intents)):
            for j in range(len(intents)):
                if i != j and cm[i, j] > 0:
                    error_patterns.append({
                        'true_intent': intents[i],
                        'predicted_intent': intents[j],
                        'count': int(cm[i, j])
                    })
        
        error_patterns.sort(key=lambda x: x['count'], reverse=True)
        
        return {
            'confusion_matrix': cm.tolist(),
            'intents': intents,
            'per_class_metrics': per_class_metrics,
            'error_patterns': error_patterns,
            'overall_accuracy': float((df['intent'] == df['predicted_intent']).mean()),
            'total_samples': len(df),
            'total_errors': int(len(df) - (df['intent'] == df['predicted_intent']).sum())
        }
    
    def get_gemini_insights(self, data: dict) -> str:
        """Get AI-powered insights from Gemini."""
        if not self.gemini_available:
            return "Gemini AI not available - using standard analysis."
        
        print("Getting Gemini AI insights...")
        
        prompt = f"""
Analyze this confusion matrix data for a disaster response NLP intent classification model and provide insights:

## Model Performance
- Overall Accuracy: {data['overall_accuracy']:.4f}
- Total Samples: {data['total_samples']}
- Total Errors: {data['total_errors']}
- Intent Classes: {len(data['intents'])}

## Per-Class Performance
{json.dumps(data['per_class_metrics'], indent=2)}

## Error Patterns
{json.dumps(data['error_patterns'][:10], indent=2)}

## Intent Classes
{', '.join(data['intents'])}

Please provide:
1. Overall assessment of model performance
2. Analysis of the most problematic intent classes
3. Insights into common error patterns
4. Recommendations for improving the model
5. Any observations about class imbalance or data quality issues

Keep the analysis concise and actionable.
"""
        
        try:
            response = self.gemini_model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini API error: {e}")
            return "Gemini analysis failed - using standard analysis."
    
    def plot_confusion_matrix(self, cm: np.ndarray, intents: list, 
                            save_path: str = 'gemini_confusion_matrix.png'):
        """Generate confusion matrix visualization."""
        print("Generating confusion matrix visualization...")
        
        fig, ax = plt.subplots(figsize=(14, 12))
        
        sns.heatmap(cm, annot=True, fmt='d', cmap='RdBu_r',
                   xticklabels=intents, yticklabels=intents,
                   cbar_kws={'label': 'Count'},
                   annot_kws={'size': 7},
                   linewidths=0.5, linecolor='gray')
        
        plt.title('QSAFE NLP Confusion Matrix (Gemini Analysis)', fontsize=16, fontweight='bold', pad=20)
        plt.xlabel('Predicted Intent', fontsize=12, fontweight='bold')
        plt.ylabel('True Intent', fontsize=12, fontweight='bold')
        plt.xticks(rotation=45, ha='right', fontsize=8)
        plt.yticks(rotation=0, fontsize=8)
        plt.tight_layout()
        
        output_path = self.metrics_dir / save_path
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"📊 Confusion matrix saved to {output_path}")
        plt.close()
        
        return str(output_path)
    
    def generate_report(self, data: dict, gemini_insights: str) -> dict:
        """Generate comprehensive report with Gemini insights."""
        report = {
            'timestamp': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
            'model_performance': {
                'overall_accuracy': data['overall_accuracy'],
                'total_samples': data['total_samples'],
                'total_errors': data['total_errors'],
                'error_rate': data['total_errors'] / data['total_samples']
            },
            'per_class_analysis': data['per_class_metrics'],
            'error_patterns': data['error_patterns'][:10],
            'gemini_insights': gemini_insights,
            'intent_classes': data['intents']
        }
        
        return report
    
    def run_analysis(self) -> dict:
        """Run complete Gemini-powered confusion matrix analysis."""
        print("="*60)
        print("GEMINI-POWERED CONFUSION MATRIX ANALYSIS")
        print("="*60)
        
        # Load data and run inference
        df = self.load_validation_data()
        df = self.run_inference(df)
        
        # Generate confusion matrix data
        data = self.generate_confusion_matrix_data(df)
        
        # Get Gemini insights
        gemini_insights = self.get_gemini_insights(data)
        
        # Generate visualization
        cm = np.array(data['confusion_matrix'])
        plot_path = self.plot_confusion_matrix(cm, data['intents'])
        
        # Generate report
        report = self.generate_report(data, gemini_insights)
        report['visualization'] = plot_path
        
        # Save report
        report_path = self.metrics_dir / 'gemini_confusion_matrix_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"💾 Report saved to {report_path}")
        
        return report
    
    def print_summary(self, report: dict):
        """Print analysis summary."""
        print("\n" + "="*60)
        print("GEMINI ANALYSIS SUMMARY")
        print("="*60)
        
        perf = report['model_performance']
        print(f"\nOverall Accuracy: {perf['overall_accuracy']:.4f}")
        print(f"Total Samples: {perf['total_samples']}")
        print(f"Total Errors: {perf['total_errors']}")
        print(f"Error Rate: {perf['error_rate']:.4%}")
        
        print("\n--- Gemini AI Insights ---")
        print(report['gemini_insights'])
        
        print("\n--- Top Error Patterns ---")
        for error in report['error_patterns'][:5]:
            print(f"{error['true_intent']} → {error['predicted_intent']}: {error['count']} errors")
        
        print("="*60)


def main():
    """Main entry point."""
    generator = GeminiConfusionMatrixGenerator()
    report = generator.run_analysis()
    generator.print_summary(report)
    print("\n✅ Gemini-powered confusion matrix analysis complete!")


if __name__ == '__main__':
    main()
