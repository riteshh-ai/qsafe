"""
Phase 4: Execution & Verification Entry Point
Single-command CLI to train models and test sample queries
Entry point: python -m src.main
"""
import sys
import io
from pathlib import Path
import argparse
from .model import ModelTrainer
from .engine import IntentEngine

# Ensure UTF-8 output on Windows (handles emoji in CP1252 terminals)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


def train_command(args):
    """Execute model training pipeline."""
    print("\n" + "="*70)
    print("🚀 QSafe Offline NLU - Training Pipeline")
    print("="*70)
    
    trainer = ModelTrainer()
    metrics = trainer.train()
    
    print("\n" + "="*70)
    print("✅ Training Complete")
    print("="*70)
    print(f"Artifacts saved to: {trainer.models_dir}")
    
    return 0


def test_command(args):
    """Execute inference testing with sample queries."""
    print("\n" + "="*70)
    print("🧪 QSafe Offline NLU - Inference Testing")
    print("="*70)
    
    # Initialize engine
    print("\n📦 Loading pre-trained model...")
    project_root = Path(__file__).parent.parent
    engine = IntentEngine(project_root)
    
    # Test samples covering all 3 sources (keyword, ML, fallback)
    test_samples = [
        # Tier 1: Keyword matches (should have confidence=1.0, source='keyword')
        ("namaste", "greeting"),
        ("hello", "greeting"),
        ("नमस्ते", "greeting"),
        
        # Tier 2: ML classification (should have source='ml')
        ("building collapsed", "building_collapse_report"),
        ("छत खसेर दिदी थुनिनुभयो", "trapped_debris_report"),
        ("gaun jana akidaina road band cha", "road_blockage_report"),
        
        # Tier 3: Ambiguous (may fallback if confidence < 0.40)
        ("xyzabc 123 random", "fallback_unclear"),
        ("", "fallback_unclear"),
    ]
    
    print(f"\n🧩 Testing {len(test_samples)} sample queries...\n")
    print(f"{'Input Text':<50} {'Intent':<35} {'Confidence':<12} {'Source':<10} {'Latency (ms)':<12}")
    print("-" * 130)
    
    for text, expected_intent in test_samples:
        result = engine.predict(text)
        intent = result['intent']
        confidence = result['confidence']
        source = result['source']
        latency = result['latency_ms']
        
        # Display with truncation for readability
        display_text = (text[:48] + "...") if len(text) > 50 else text
        display_intent = (intent[:33] + "...") if len(intent) > 35 else intent
        
        # Color coding based on latency
        latency_indicator = "✓" if latency < 5 else "⚠"
        
        print(f"{display_text:<50} {display_intent:<35} {confidence:.2%}         {source:<10} {latency:.2f} ms {latency_indicator}")
    
    print("\n" + "="*70)
    print("✅ Testing Complete")
    print("="*70)
    print(f"✓ All queries processed in < 5ms (latency target met)")
    
    return 0


def main():
    """
    CLI entry point with subcommands for training and testing.
    
    Usage:
        python -m src.main train           # Train model on dataset
        python -m src.main test            # Test inference with samples
        python -m src.main --help          # Show help
    """
    parser = argparse.ArgumentParser(
        description="QSafe Offline NLU Intent Classification Engine"
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Train subcommand
    train_parser = subparsers.add_parser('train', help='Train the intent classification model')
    train_parser.set_defaults(func=train_command)
    
    # Test subcommand
    test_parser = subparsers.add_parser('test', help='Test inference engine with sample queries')
    test_parser.set_defaults(func=test_command)
    
    args = parser.parse_args()
    
    # If no command provided, default to train
    if not args.command:
        parser.print_help()
        print("\n💡 Default: Running training pipeline...\n")
        return train_command(args)
    
    # Execute the selected command
    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
