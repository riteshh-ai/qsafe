// backend/list-models.js
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function checkModels() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.models) {
      console.log("✅ Supported models for your API key:");
      data.models.forEach((m) => {
        if (m.supportedGenerationMethods?.includes("generateContent")) {
          console.log(` - ${m.name.replace('models/', '')}`);
        }
      });
    } else {
      console.log("❌ Key Error Response:", data);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

checkModels();