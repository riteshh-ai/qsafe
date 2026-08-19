import os
import time
import chromadb

# 1. API Keys for rotation to handle rate limits seamlessly
API_KEYS = [
    os.environ.get("GOOGLE_API_KEY_1", ""),
    os.environ.get("GOOGLE_API_KEY_2", ""),
    os.environ.get("GOOGLE_API_KEY_3", ""),
    os.environ.get("GOOGLE_API_KEY_4", ""),
    os.environ.get("GOOGLE_API_KEY_5", "")
]

# Filter out empty placeholders
API_KEYS = [k for k in API_KEYS if k and not k.startswith("PASTE_")]

if not API_KEYS:
    raise ValueError("Please provide at least one valid Gemini API key via environment variables (GOOGLE_API_KEY_1, etc.)!")

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

# 2. Initialize ChromaDB persistent connection
chroma_path = os.path.join(os.getcwd(), "chroma_db")
chroma_client = chromadb.PersistentClient(path=chroma_path)
collection = chroma_client.get_collection(name="disaster_response_db")

def generate_embedding(text):
    """Generates embedding for incoming query with automatic key rotation."""
    global current_key_idx, client, use_new_sdk
    
    for _ in range(len(API_KEYS)):
        try:
            if use_new_sdk:
                res = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=text
                )
                return res.embeddings[0].values
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
                print(f"[Retriever] Rate limit hit. Switched to API Key #{current_key_idx + 1}")
                time.sleep(1.0)
            else:
                raise e
    raise RuntimeError("All configured API keys are rate-limited. Please try again later.")

def get_relevant_context(user_query, top_k=3):
    """
    Main function for backend integration.
    Converts query to vector, searches ChromaDB, and returns retrieved text snippets.
    """
    query_vector = generate_embedding(user_query)
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k
    )
    
    docs = results['documents'][0]
    return "\n---\n".join(docs)