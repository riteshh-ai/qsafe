import os
import time
import re
import chromadb

# 1. Provide all 5 API keys so testing never fails due to rate limits
API_KEYS = [
    os.environ.get("GOOGLE_API_KEY_1", ""),
    os.environ.get("GOOGLE_API_KEY_2", ""),
    os.environ.get("GOOGLE_API_KEY_3", ""),
    os.environ.get("GOOGLE_API_KEY_4", ""),
    os.environ.get("GOOGLE_API_KEY_5", "")
]

# Filter out empty placeholders
API_KEYS = [k for k in API_KEYS if k and not k.startswith("PASTE_")]

current_key_idx = 0

def get_genai_client(key_index):
    key = API_KEYS[key_index]
    try:
        from google import genai
        return genai.Client(api_key=key), True
    except ImportError:
        import google.generativeai as genai_legacy
        genai_legacy.configure(api_key=key)
        return genai_legacy, False

client, use_new_sdk = get_genai_client(current_key_idx)

# 2. Connect to local ChromaDB
chroma_path = os.path.join(os.getcwd(), "chroma_db")
chroma_client = chromadb.PersistentClient(path=chroma_path)
collection = chroma_client.get_collection(name="disaster_response_db")

print(f"Total records stored in ChromaDB: {collection.count()}")

def generate_embedding_with_fallback(text):
    global current_key_idx, client, use_new_sdk
    
    for _ in range(len(API_KEYS)):
        try:
            if use_new_sdk:
                response = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=text
                )
                return response.embeddings[0].values
            else:
                res = client.embed_content(
                    model="models/gemini-embedding-001",
                    content=text
                )
                return res['embedding']
        except Exception as e:
            err_str = str(e)
            if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                current_key_idx = (current_key_idx + 1) % len(API_KEYS)
                client, use_new_sdk = get_genai_client(current_key_idx)
                print(f"[Key Exhausted] Switched to Key #{current_key_idx + 1}...")
                time.sleep(1.0)
            else:
                raise e
    raise RuntimeError("All configured API keys are rate-limited. Please wait 1 minute and retry.")

def search_rag(query_text, top_k=3):
    print(f"\nTesting Query: '{query_text}'")
    
    # Generate query embedding vector using Gemini
    query_vector = generate_embedding_with_fallback(query_text)

    # Search ChromaDB
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k
    )

    print("\n--- Top Matching Results ---")
    for i, doc in enumerate(results['documents'][0]):
        meta = results['metadatas'][0][i]
        print(f"\nResult #{i+1} [Source: {meta.get('source', 'Unknown')}]:")
        print(doc[:250] + "...")

# 3. Run Query
if __name__ == "__main__":
    search_rag("What emergency contact numbers are available for earthquake relief?", top_k=3)