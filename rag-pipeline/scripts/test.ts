import { generateAnswerWithRetrieval } from "../services/generationService.js";

async function test() {
  console.log("🧪 Testing RAG System\n");

  const testQuestion = "What emergency contact numbers are available for earthquake relief?";

  try {
    const result = await generateAnswerWithRetrieval(testQuestion, 5);

    console.log("Question:", result.question);
    console.log("Classification:", result.classification);
    console.log("Answer:", result.answer);
    console.log("Sources:", result.retrieved_sources);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
