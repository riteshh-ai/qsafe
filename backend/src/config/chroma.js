
// src/config/chroma.js - ChromaDB Cloud Configuration via the official chromadb client
import { CloudClient } from 'chromadb';
import dotenv from 'dotenv';

dotenv.config();

const TENANT = process.env.CHROMA_TENANT || 'c13287d8-f0ff-4f53-8d0a-6af2863906af';
const DATABASE = process.env.CHROMA_DATABASE || 'disaster-responsedb';
const COLLECTION_NAME = process.env.CHROMA_COLLECTION || 'disaster_response_db';

let clientInstance = null;

function getClient() {
  if (!clientInstance) {
    const apiKey = process.env.CHROMA_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('CHROMA_API_KEY is not configured in .env file.');
    }
    clientInstance = new CloudClient({
      apiKey,
      tenant: TENANT,
      database: DATABASE,
    });
  }
  return clientInstance;
}

// The REST API needs the collection's internal ID for query/get/add/etc,
// not its name (only a couple of lookup endpoints accept the name).
// The client's getCollection() call resolves name -> id for us, so we
// fetch it once and cache the resolved collection handle.
let collectionPromise = null;

function getCollection() {
  if (!collectionPromise) {
    const client = getClient();
    collectionPromise = client.getCollection({ name: COLLECTION_NAME }).catch((err) => {
      collectionPromise = null; // allow a retry on the next call instead of caching a failure
      throw err;
    });
  }
  return collectionPromise;
}

/**
 * Search embeddings in ChromaDB Cloud
 * @param {number[]} embedding - the query embedding
 * @param {number} topK - how many results to return
 * @param {object} [where] - optional metadata filter, e.g. { source: "PROcessed_manual.csv" }
 */
export async function searchEmbeddings(embedding, topK = 5, where = undefined) {
  try {
    console.log(`🔍 Querying ChromaDB Cloud for top ${topK} matches${where ? ` (filtered: ${JSON.stringify(where)})` : ""}...`);

    const collection = await getCollection();
    const results = await collection.query({
      queryEmbeddings: [embedding],
      nResults: topK,
      where,
      include: ["metadatas", "documents", "distances"],
    });

    // Format results to match expected structure
    const matches = [];
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        matches.push({
          id: results.ids[0][i],
          score: results.distances ? (1 - results.distances[0][i]) : 0.5,
          metadata: {
            ...(results.metadatas?.[0]?.[i] || {}),
            text: results.documents[0][i],
          },
        });
      }
    }

    console.log(`✅ Retrieved ${matches.length} documents from ChromaDB Cloud`);
    return matches;
  } catch (error) {
    console.error("❌ ChromaDB Search Error:", error.message);
    throw error;
  }
}

/**
 * Fetch specific documents directly by their ChromaDB IDs - no embedding
 * or similarity search involved. General-purpose exact lookup.
 */
export async function getDocumentsByIds(ids) {
  try {
    if (!ids || ids.length === 0) return [];
    const collection = await getCollection();
    const results = await collection.get({
      ids,
      include: ["metadatas", "documents"],
    });

    const matches = [];
    if (results.ids) {
      for (let i = 0; i < results.ids.length; i++) {
        matches.push({
          id: results.ids[i],
          score: 1.0, // exact requested match, not a similarity score
          metadata: {
            ...(results.metadatas?.[i] || {}),
            text: results.documents?.[i],
          },
        });
      }
    }
    return matches;
  } catch (error) {
    console.error("❌ ChromaDB Get-By-ID Error:", error.message);
    return [];
  }
}

/**
 * Fetch ALL documents matching a metadata filter (e.g. { source: "X" }) -
 * no embedding, no similarity ranking, no ID list needed. Intended for
 * small, static subsets of the collection where it's more reliable to
 * include everything than to trust similarity search to pick "the best
 * few" (which is exactly where cross-lingual queries can miss).
 */
export async function getAllDocumentsBySource(where) {
  try {
    const collection = await getCollection();
    const results = await collection.get({
      where,
      include: ["metadatas", "documents"],
    });

    const matches = [];
    if (results.ids) {
      for (let i = 0; i < results.ids.length; i++) {
        matches.push({
          id: results.ids[i],
          score: 1.0,
          metadata: {
            ...(results.metadatas?.[i] || {}),
            text: results.documents?.[i],
          },
        });
      }
    }
    return matches;
  } catch (error) {
    console.error("❌ ChromaDB Get-All-By-Source Error:", error.message);
    return [];
  }
}

/**
 * Get embedding count from ChromaDB Cloud
 */
export async function getEmbeddingCount() {
  try {
    const collection = await getCollection();
    const count = await collection.count();
    console.log(`📊 ChromaDB Cloud - Total Documents: ${count}`);
    return count;
  } catch (error) {
    console.error("❌ Error fetching embedding count:", error.message);
    return 0;
  }
}

export default { searchEmbeddings, getDocumentsByIds, getAllDocumentsBySource, getEmbeddingCount };
