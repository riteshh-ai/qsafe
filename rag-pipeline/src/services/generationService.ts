import { retrieveContext } from "./retrievalService.js";

export async function generateAnswerWithRetrieval(
  question: string,
  topK: number = 5
): Promise<{
  question: string;
  answer: string;
  retrieved_sources: string[];
  classification: "Answered" | "Refused";
}> {
  try {
    const results = await retrieveContext(question, topK);
    const sourceIds = results.map((r) => r.id);

    if (results.length === 0) {
      return {
        question,
        answer: "I don't know based on the available information.",
        retrieved_sources: [],
        classification: "Refused",
      };
    }

    // Since Gemini generation models are not available, format retrieved documents as answer
    const formattedAnswer = results
      .map((r, i) => `${i + 1}. ${r.text}`)
      .join("\n\n");

    const answer = `Based on available information:\n\n${formattedAnswer}`;

    return {
      question,
      answer,
      retrieved_sources: sourceIds,
      classification: "Answered",
    };
  } catch (error) {
    console.error("Generation failed:", error);
    throw error;
  }
}
