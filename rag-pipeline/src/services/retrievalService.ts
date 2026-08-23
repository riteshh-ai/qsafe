import { generateEmbedding } from "../config/gemini.js";
import {
  getIndex,
  searchEmbeddings,
} from "../config/chromaDb.js";

export interface RetrievalResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, any>;
}

export async function retrieveContext(
  query: string,
  topK: number = 5
): Promise<RetrievalResult[]> {
  try {
    console.log(`🔍 Searching for: "${query}"`);

    const queryEmbedding = await generateEmbedding(query);
    const results = await searchEmbeddings(queryEmbedding, topK);

    const formatted = results.map((match: any) => ({
      id: match.id,
      text: match.metadata?.text || "",
      score: match.score,
      metadata: match.metadata || {},
    }));

    console.log(`📚 Retrieved ${formatted.length} documents`);
    return formatted;
  } catch (error) {
    console.error("Retrieval failed:", error);
    throw error;
  }
}

export function formatContextForGeneration(
  results: RetrievalResult[]
): string {
  return results
    .map((r, i) => `[${i + 1}] ${r.text}`)
    .join("\n\n---\n\n");
}
