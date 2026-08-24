import os
import json
import time
import re
import pandas as pd
import chromadb

# Ensure script runs relative to its execution directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 1. Multi-API Key Setup (5 Keys Slot)
API_KEYS = [
    os.environ.get("GOOGLE_API_KEY_1", ""),
    os.environ.get("GOOGLE_API_KEY_2", ""),
    os.environ.get("GOOGLE_API_KEY_3", ""),
    os.environ.get("GOOGLE_API_KEY_4", ""),
    os.environ.get("GOOGLE_API_KEY_5", "")
]

# Filter out empty placeholders or unset keys
API_KEYS = [k for k in API_KEYS if k and not k.startswith("PASTE_")]

if not API_KEYS:
    raise ValueError("Please provide at least one valid Gemini API key!")

current_key_idx = 0

def get_genai_client(key_index):
    key = API_KEYS[key_index]
    print(f"\n[KEY ROTATION] Activating API Key #{key_index + 1} ({key[:6]}...{key[-4:]})")
    try:
        from google import genai
        return genai.Client(api_key=key), True
    except ImportError:
        import google.generativeai as genai_legacy
        genai_legacy.configure(api_key=key)
        return genai_legacy, False

client, use_new_sdk = get_genai_client(current_key_idx)

# 2. Setup Persistent ChromaDB
chroma_path = os.path.join(os.getcwd(), "chroma_db")
chroma_client = chromadb.PersistentClient(path=chroma_path)
collection = chroma_client.get_or_create_collection(
    name="disaster_response_db",
    metadata={"hnsw:space": "cosine"}
)

print(f"Target ChromaDB directory: {chroma_path}")

def parse_retry_delay(err_msg, default=35.0):
    match = re.search(r"retryDelay['\"]?\s*:\s*['\"]?(\d+)s?", err_msg, re.I)
    if match:
        return float(match.group(1))
    match = re.search(r"Please retry in (\d+(?:\.\d+)?)s", err_msg, re.I)
    if match:
        return float(match.group(1))
    return default

def generate_embedding(texts):
    global client, use_new_sdk
    if use_new_sdk:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts
        )
        return [e.values for e in response.embeddings]
    else:
        results = []
        for t in texts:
            res = client.embed_content(
                model="models/gemini-embedding-001",
                content=t
            )
            results.append(res['embedding'])
        return results

def embed_and_store(file_name, text_col, id_col, meta_col=None):
    global current_key_idx, client, use_new_sdk
    
    csv_path = os.path.join("data", file_name)
    if not os.path.exists(csv_path):
        print(f"Skipping {csv_path} (File not found in ./data folder)")
        return

    df = pd.read_csv(csv_path)
    total_records = len(df)
    print(f"\nEvaluating dataset: {csv_path} ({total_records} total records)")

    # Deduplication check: fetch existing IDs from DB to prevent re-processing
    existing_ids = set(collection.get(include=[])['ids'])
    df['chroma_id'] = [f"{file_name}_{x}" for x in df[id_col].astype(str)]
    df_to_process = df[~df['chroma_id'].isin(existing_ids)].copy()
    
    already_done = total_records - len(df_to_process)
    if already_done > 0:
        print(f"-> {already_done}/{total_records} records already stored in ChromaDB.")
    
    if len(df_to_process) == 0:
        print(f"-> All records from {file_name} are already ingested. Skipping.")
        return

    print(f"-> Ingesting remaining {len(df_to_process)} records...")

    batch_size = 50
    total = len(df_to_process)
    
    for i in range(0, total, batch_size):
        batch = df_to_process.iloc[i:i+batch_size]
        ids = batch['chroma_id'].tolist()
        texts = batch[text_col].astype(str).tolist()
        
        metadatas = []
        if meta_col and meta_col in batch.columns:
            for m in batch[meta_col]:
                if isinstance(m, str) and m.strip().startswith('{'):
                    try:
                        cleaned_str = m.replace("'", '"')
                        meta_dict = json.loads(cleaned_str)
                        sanitized = {
                            k: (str(v) if isinstance(v, (dict, list)) else v)
                            for k, v in meta_dict.items()
                            if v is not None and isinstance(v, (str, int, float, bool, dict, list))
                        }
                        sanitized["source"] = file_name
                        metadatas.append(sanitized)
                    except Exception:
                        metadatas.append({"source": file_name, "raw_data": str(m)[:100]})
                else:
                    metadatas.append({"source": file_name, "raw_data": str(m)})
        else:
            metadatas = [{"source": file_name} for _ in range(len(batch))]

        success = False
        attempt = 0
        keys_tried_in_round = 0
        
        while not success:
            try:
                embeddings = generate_embedding(texts)
                collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    documents=texts,
                    metadatas=metadatas
                )
                success = True
            except Exception as e:
                err_str = str(e)
                if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                    attempt += 1
                    keys_tried_in_round += 1
                    
                    # Cycle to the next key (wraps back to 0 if at the end of the list)
                    old_idx = current_key_idx + 1
                    current_key_idx = (current_key_idx + 1) % len(API_KEYS)
                    client, use_new_sdk = get_genai_client(current_key_idx)
                    
                    print(f"--> Quota hit on Key #{old_idx}. Switching to Key #{current_key_idx + 1}...")
                    
                    # If all keys in the list have been rotated once, pause briefly before retrying
                    if keys_tried_in_round >= len(API_KEYS):
                        keys_tried_in_round = 0
                        parsed_delay = parse_retry_delay(err_str, default=35.0)
                        wait_time = max(parsed_delay + 5.0, 30.0 * (1.5 ** (attempt - 1)))
                        wait_time = min(wait_time, 180.0)
                        print(f"All {len(API_KEYS)} keys limited. Waiting {wait_time:.1f}s before retrying (Attempt {attempt})...")
                        time.sleep(wait_time)
                    else:
                        time.sleep(1.0)
                        continue
                else:
                    raise e

        print(f"Processed {min(i + batch_size, total)}/{total} new records...")
        time.sleep(3.0)

# 3. Execute Ingestion Across All 4 Datasets
embed_and_store("PROcessed_nepal_seismicity.csv", "rag_input_text", "id", "metadata_payload")
embed_and_store("History_processed_dataser2.csv", "rag_input_text", "id", "metadata_payload")
embed_and_store("PROcessed_manual.csv", "rag_input_text", "id", "metadata_payload")
embed_and_store("National_Emergency_Contacts.csv", "Agency / Organization", "S.N.")

print("\nSuccess! All 4 datasets ingested completely into ChromaDB:", chroma_path)