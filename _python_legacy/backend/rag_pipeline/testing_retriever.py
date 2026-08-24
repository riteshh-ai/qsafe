from retriver import get_relevant_context

if __name__ == "__main__":
    query = "What are the emergency contact numbers available for ambulance and earthquake relief?"
    print(f"Testing Retrieval for: '{query}'")
    
    # Retrieve context
    context = get_relevant_context(query, top_k=3)
    
    print("\n--- RETRIEVED CONTEXT ---")
    print(context)