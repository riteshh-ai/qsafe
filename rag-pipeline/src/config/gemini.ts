import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./env.js";

const genAI = new GoogleGenerativeAI(config.gemini.apiKeys[0]);
let currentKeyIndex = 0;

export function getClient() {
  const key = config.gemini.apiKeys[currentKeyIndex % config.gemini.apiKeys.length];
  return new GoogleGenerativeAI(key);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  for (let attempt = 0; attempt < config.gemini.apiKeys.length; attempt++) {
    try {
      const client = getClient();
      // Use models/gemini-embedding-001 which produces 3072-dimensional embeddings
      const model = client.getGenerativeModel({ model: "models/gemini-embedding-001" });

      const result = await model.embedContent(text);
      const embedding = result.embedding as any;
      return embedding.values || embedding;
    } catch (error: any) {
      if (
        error.message?.includes("RESOURCE_EXHAUSTED") ||
        error.status === 429
      ) {
        console.log(
          `[API Rotation] Switching from Key #${currentKeyIndex + 1}`
        );
        currentKeyIndex = (currentKeyIndex + 1) % config.gemini.apiKeys.length;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("All API keys exhausted for embedding");
}

export async function generateAnswer(
  prompt: string
): Promise<string> {
  for (let attempt = 0; attempt < config.gemini.apiKeys.length; attempt++) {
    try {
      const client = getClient();
      const model = client.getGenerativeModel({
        model: config.gemini.generationModel
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      if (
        error.message?.includes("RESOURCE_EXHAUSTED") ||
        error.status === 429
      ) {
        console.log(
          `[Generation] Switching from Key #${currentKeyIndex + 1}`
        );
        currentKeyIndex = (currentKeyIndex + 1) % config.gemini.apiKeys.length;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("All API keys exhausted for generation");
}
