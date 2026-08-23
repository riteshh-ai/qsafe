import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000"),
  nodeEnv: process.env.NODE_ENV || "development",

  gemini: {
    apiKeys: [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ].filter(Boolean) as string[],
    embeddingModel: "models/gemini-embedding-001",
    generationModel: "models/gemini-1.0-pro",
  },

  chroma: {
    apiKey: process.env.CHROMA_API_KEY || "",
    tenant: process.env.CHROMA_TENANT || "c13287d8-f0ff-4f53-8d0a-6af2863906af",
    database: process.env.CHROMA_DATABASE || "disaster-responsedb",
    collection: process.env.CHROMA_COLLECTION || "disaster_response_db",
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

// Validate required keys
if (config.gemini.apiKeys.length === 0) {
  throw new Error("❌ No Gemini API keys found in .env");
}

if (!config.chroma.apiKey) {
  throw new Error("❌ ChromaDB Cloud API key not found in .env");
}

console.log(`✅ Config loaded - ${config.gemini.apiKeys.length} Gemini keys, ChromaDB Cloud ready (${config.chroma.database})`);
