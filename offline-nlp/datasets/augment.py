import pandas as pd
import random
from pathlib import Path

def generate_typo(text):
    if len(text) < 5: return text
    # Swap two random adjacent characters
    idx = random.randint(0, len(text)-2)
    return text[:idx] + text[idx+1] + text[idx] + text[idx+2:]

def generate_missing_vowel(text):
    vowels = "aeiou"
    for v in vowels:
        if v in text:
            return text.replace(v, "", 1)
    return text

def augment_data():
    base_dir = Path(__file__).parent
    csv_path = base_dir / "training_dataset.csv"
    
    if not csv_path.exists():
        print("Training dataset not found!")
        return

    df = pd.read_csv(csv_path, encoding='utf-8')
    
    augmented_rows = []
    
    print(f"Original dataset size: {len(df)}")
    
    # We only augment the 'train' split to prevent validation leakage
    train_df = df[df['split'] == 'train']
    
    for _, row in train_df.iterrows():
        text = str(row['text'])
        intent = row['intent']
        
        # 1. Typo variation
        if random.random() < 0.3:
            augmented_rows.append({"text": generate_typo(text), "intent": intent, "split": "train"})
            
        # 2. Missing vowel variation
        if random.random() < 0.2:
            augmented_rows.append({"text": generate_missing_vowel(text), "intent": intent, "split": "train"})
            
    aug_df = pd.DataFrame(augmented_rows)
    final_df = pd.concat([df, aug_df], ignore_index=True)
    
    # Save back
    final_df.to_csv(csv_path, index=False, encoding='utf-8')
    print(f"Augmented dataset size: {len(final_df)}")
    print("Augmentation complete. Ready for retraining.")

if __name__ == "__main__":
    augment_data()
