// test-rag-connection.js
import dotenv from 'dotenv';
import { queryChromaCollection, getPineconeStats } from './src/services/chromaServices.js';

dotenv.config();

async function testRAGConnection() {
  console.log("🧪 Testing RAG Pipeline Connection...\n");

  try {
    // 1. Check Pinecone connection
    console.log("1️⃣ Checking Pinecone connection...");
    const stats = await getPineconeStats();
    if (stats) {
      console.log(`   ✅ Pinecone connected`);
      console.log(`   📊 Index: ${process.env.PINECONE_INDEX_NAME}`);
      console.log(`   📈 Total Records: ${stats.totalRecordCount || 0}\n`);
    }

    // 2. Test query
    console.log("2️⃣ Testing query to Pinecone...");
    const testQuery = "What should I do during an earthquake?";
    const results = await queryChromaCollection(testQuery, 3);

    if (results && !results.includes("No additional")) {
      console.log(`   ✅ Query successful!`);
      console.log(`   📄 Retrieved documents:\n${results.substring(0, 200)}...\n`);
    } else {
      console.log(`   ⚠️  No documents retrieved or error occurred\n`);
    }

    console.log("✅ RAG Connection Test Complete!\n");

  } catch (error) {
    console.error("❌ Test Failed:", error.message);
    console.error("\nTroubleshooting:");
    console.error("- Check .env file has PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME");
    console.error("- Verify Pinecone index has documents ingested");
    console.error("- Check internet connection");
  }
}

testRAGConnection();
