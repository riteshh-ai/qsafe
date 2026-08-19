// src/services/chromaService.js

/**
 * Queries the Python ChromaDB microservice for relevant context.
 */
export const queryChromaCollection = async (userMessage) => {
  try {
    const response = await fetch('http://localhost:8001/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: userMessage })
    });

    if (response.ok) {
      const data = await response.json();
      return data.context || "No additional static safety documents retrieved.";
    } else {
      console.warn("ChromaDB Query Warning: Microservice returned status", response.status);
      return "No additional static safety documents retrieved.";
    }
  } catch (error) {
    console.warn("ChromaDB Query Warning:", error.message);
    return "No additional static safety documents retrieved.";
  }
};