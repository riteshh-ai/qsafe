

//fdsawfrwfwnfjklsjfsnkjfsfsff
//sfsfsdfsklfjdsfjahfskjfjsfsafklfksjfheifejifesfesfewf

import { CloudClient, type Collection } from "chromadb";
import { config } from "./env.js";

const COLLECTION_NAME = config.chroma.collection || 'disaster_response_db';
const TENANT = config.chroma.tenant;
const DATABASE = config.chroma.database;

const client = new CloudClient({
  apiKey: config.chroma.apiKey,
  tenant: TENANT,
  database: DATABASE,
});

// We always pass pre-computed queryEmbeddings ourselves (see searchEmbeddings
// below), so this is never actually invoked - it only exists to satisfy the
// SDK's required embeddingFunction parameter.
const unusedEmbeddingFunction = {
  generate: async (_texts: string[]): Promise<number[][]> => {
    throw new Error("Embedding function should not be called - embeddings are supplied directly.");
  },
};

// The REST API needs the collection's internal ID for query/get/add/etc,
// not its name (only a couple of lookup endpoints accept the name).
// getCollection() resolves name -> id for us, so cache the handle once.
let collectionInstance: Collection | null = null;

/**
 * Initialize ChromaDB Cloud connection
 */
export async function initializeVectorDb() {
  try {
    console.log(`🌐 Connecting to ChromaDB Cloud...`);
    console.log(`👤 Tenant: ${TENANT}`);
    console.log(`🗄️  Database: ${DATABASE}`);
    console.log(`📋 Collection: ${COLLECTION_NAME}`);

    collectionInstance = await client.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: unusedEmbeddingFunction,
    });

    console.log(`✅ Connected to ChromaDB Cloud collection: ${COLLECTION_NAME}`);
    return collectionInstance;
  } catch (error) {
    console.error("❌ Failed to initialize ChromaDB Cloud:", error);
    throw error;
  }
}

/**
 * Get ChromaDB collection instance
 */
export async function getIndex() {
  if (!collectionInstance) {
    return await initializeVectorDb();
  }
  return collectionInstance;
}

/**
 * Store embedding in ChromaDB Cloud
 * NOTE: Data already uploaded via Python script - this is a no-op
 */
export async function storeEmbedding(
  id: string,
  embedding: number[],
  metadata: Record<string, any>,
  text: string
) {
  console.log(`⏭️  Skipping upload (data already in CloudChromaDB): ${id}`);
  // Data was already uploaded by Python script
  // This function is kept for compatibility but does nothing
}

/**
 * Search embeddings in ChromaDB Cloud
 */
export async function searchEmbeddings(
  embedding: number[],
  topK: number = 5
) {
  try {
    const collection = await getIndex();

    const results = await collection.query({
      queryEmbeddings: [embedding],
      nResults: topK,
      include: ["metadatas", "documents", "distances"] as any,
    });

    const matches: any[] = [];
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        matches.push({
          id: results.ids[0][i],
          score: results.distances ? (1 - (results.distances[0][i] as number)) : 0.5,
          metadata: {
            ...(results.metadatas?.[0]?.[i] || {}),
            text: results.documents?.[0]?.[i],
          },
        });
      }
    }

    return matches;
  } catch (error) {
    console.error("❌ Failed to search embeddings:", error);
    throw error;
  }
}

/**
 * Get embedding count from ChromaDB Cloud
 */
export async function getEmbeddingCount() {
  try {
    const collection = await getIndex();
    return await collection.count();
  } catch (error) {
    console.error("❌ Failed to get embedding count:", error);
    return 0;
  }
}
