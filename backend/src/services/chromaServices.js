import { searchEmbeddings, getAllDocumentsBySource, getEmbeddingCount } from '../config/chroma.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate embedding for a query using Gemini
 */
async function generateQueryEmbedding(query) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });
    const result = await model.embedContent(query);
    return result.embedding.values;
  } catch (error) {
    console.error("❌ Embedding generation failed:", error.message);
    throw error;
  }
}

// The manual/handbook corpus is small (~20 documents) and static, so rather
// than relying on similarity search to pick "the most relevant few" - which
// can miss cross-lingual matches (confirmed: English "emergency kit" never
// ranked in the top 3 out of just 20 Nepali-language docs, even with the
// wrong 4,070 seismic-event records excluded) - we simply always include
// the ENTIRE manual corpus in every response. This removes retrieval risk
// for this content for every topic it covers, not just the ones we've
// happened to test, and needs no per-topic keyword list to maintain.
// It's cached after the first successful fetch since this content is
// static reference material that doesn't change while the server runs.
const MANUAL_SOURCE = "PROcessed_manual.csv";
let manualCorpusCache = null;

async function getManualCorpus() {
  if (manualCorpusCache && manualCorpusCache.length > 0) {
    return manualCorpusCache;
  }
  const docs = await getAllDocumentsBySource({ source: MANUAL_SOURCE });
  if (docs.length > 0) {
    console.log(`📚 Loaded and cached ${docs.length} manual/guidance documents (will reuse for future queries)`);
    manualCorpusCache = docs;
  }
  return docs;
}

/**
 * Query ChromaDB Cloud collection for relevant NDRRMA documents
 */
export const queryChromaCollection = async (userQuery, topK = 12) => {
  // 1. Always load the full manual/guidance corpus - independent of
  //    embeddings, so it's unaffected even if the vector search below fails
  //    entirely (quota, network, etc.)
  let manualMatches = [];
  try {
    manualMatches = await getManualCorpus();
  } catch (err) {
    console.warn("⚠️  Failed to load manual corpus:", err.message);
  }

  // 2. Vector search across the large raw seismic-event corpus - wrapped
  //    separately so a failure here doesn't wipe out the manual corpus
  //    already loaded above
  let generalMatches = [];
  try {
    console.log(`🔍 Searching ChromaDB Cloud for: "${userQuery}"`);

    const queryEmbedding = await generateQueryEmbedding(userQuery);
    generalMatches = await searchEmbeddings(queryEmbedding, topK);
  } catch (error) {
    console.error("🔴 ChromaDB Query Error:", error.message);
    // Don't return early - fall through so the manual corpus loaded above
    // still gets used, even though vector search failed.
  }

  // 3. Merge + de-duplicate by id - manual corpus takes priority, then
  //    general search results
  const seen = new Set();
  const matches = [];
  for (const match of [...manualMatches, ...generalMatches]) {
    if (!seen.has(match.id)) {
      seen.add(match.id);
      matches.push(match);
    }
  }

  // 4. Check if results found
  if (!matches || matches.length === 0) {
    console.log("⚠️  No matching documents found in ChromaDB Cloud");
    return "No additional static safety documents retrieved for this query.";
  }

  // 5. Format retrieved documents as context
  const contextParts = [];
  matches.forEach((match, index) => {
    const text = match.metadata?.text || '';
    const source = match.metadata?.source || 'Unknown Source';
    const score = (match.score * 100).toFixed(1);

    contextParts.push(`[Document ${index + 1} - ${source} (Relevance: ${score}%)]\n${text}`);
  });

  const contextText = contextParts.join('\n\n---\n\n');

  console.log(`✅ Retrieved ${matches.length} documents from ChromaDB Cloud (${manualMatches.length} manual corpus + ${generalMatches.length} general, deduped)`);
  return contextText;
};

/**
 * Get ChromaDB Cloud collection statistics
 */
export const getPineconeStats = async () => {
  try {
    const count = await getEmbeddingCount();
    console.log("📊 ChromaDB Cloud Stats: Total Documents =", count);
    return { totalRecordCount: count };
  } catch (error) {
    console.error("❌ Error fetching ChromaDB Cloud stats:", error.message);
    return null;
  }
};

export default { queryChromaCollection, getPineconeStats };
