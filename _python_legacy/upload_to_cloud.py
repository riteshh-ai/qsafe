#!/usr/bin/env python3
"""
Upload 4,090 pre-embedded documents from local ChromaDB to ChromaDB Cloud
Run once, then Node.js can query the cloud database
"""

import chromadb
import sys

print("🚀 Starting migration from Local ChromaDB to ChromaDB Cloud...\n")

try:
    # Step 1: Connect to LOCAL ChromaDB (your pre-embedded data)
    print("📂 Connecting to local ChromaDB...")
    local_client = chromadb.PersistentClient(
        path="D:/QSAFE/rag_test_pipeline/chroma_db"
    )
    local_collection = local_client.get_collection("disaster_response_db")

    # Get count
    local_count = local_collection.count()
    print(f"✅ Found {local_count} documents in local ChromaDB\n")

    # Step 2: Connect to CLOUD ChromaDB
    print("🌐 Connecting to ChromaDB Cloud...")
    cloud_client = chromadb.CloudClient(
        api_key="ck-BUup9f9EH3vFLVmW7gUCfP5zVicBAK19fk3f6UvKDcrr",
        tenant="c13287d8-f0ff-4f53-8d0a-6af2863906af",
        database="disaster-responsedb"
    )

    # Try to get existing collection, or create new one
    try:
        cloud_collection = cloud_client.get_collection("disaster_response_db")
        print(f"✅ Using existing CloudChromaDB collection\n")
    except:
        print("📝 Creating new collection in ChromaDB Cloud...")
        cloud_collection = cloud_client.create_collection(
            name="disaster_response_db",
            metadata={"embedding_dimension": 3072}
        )
        print(f"✅ Created new collection\n")

    # Step 3: Get ALL data from local
    print("📥 Fetching all data from local ChromaDB...")
    data = local_collection.get(include=["embeddings", "documents", "metadatas"])
    print(f"✅ Retrieved {len(data['ids'])} document records\n")

    # Step 4: Upload to cloud in batches
    print("📤 Uploading to ChromaDB Cloud...\n")
    batch_size = 50
    total = len(data['ids'])

    for i in range(0, total, batch_size):
        batch_end = min(i + batch_size, total)

        cloud_collection.add(
            ids=data['ids'][i:batch_end],
            embeddings=data['embeddings'][i:batch_end],
            documents=data['documents'][i:batch_end],
            metadatas=data['metadatas'][i:batch_end]
        )

        print(f"  ✅ Uploaded {batch_end}/{total} documents ({(batch_end/total*100):.1f}%)")

    print(f"\n{'='*60}")
    print(f"✅ MIGRATION COMPLETE!")
    print(f"{'='*60}")
    print(f"Total documents uploaded: {total}")
    print(f"CloudChromaDB is ready for Node.js queries!")
    print(f"\nNext steps:")
    print(f"1. npm run build")
    print(f"2. cd ../backend && npm start")
    print(f"3. Test: curl -X POST http://localhost:5000/api/chat...")

except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    print(f"\nTroubleshooting:")
    print(f"- Verify API key is valid")
    print(f"- Verify tenant ID exists")
    print(f"- Verify database 'disaster-responsedb' exists")
    print(f"- Check internet connection to api.trychroma.com")
    sys.exit(1)
