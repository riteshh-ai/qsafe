import express, { Router, Request, Response } from "express";
import { generateAnswerWithRetrieval } from "../services/generationService.js";
import { retrieveContext } from "../services/retrievalService.js";

const router = Router();

// Health check
router.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Retrieve documents
router.post("/api/retrieve", async (req: Request, res: Response) => {
  try {
    const { query, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const results = await retrieveContext(query, topK);

    res.json({
      query,
      results: results.map((r) => ({
        id: r.id,
        text: r.text,
        score: r.score,
      })),
      count: results.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate answer with retrieval
router.post("/api/generate", async (req: Request, res: Response) => {
  try {
    const { question, topK = 5 } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const result = await generateAnswerWithRetrieval(question, topK);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch queries
router.post("/api/batch", async (req: Request, res: Response) => {
  try {
    const { questions, topK = 5 } = req.body;

    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: "Questions must be an array" });
    }

    const results = await Promise.all(
      questions.map((q) => generateAnswerWithRetrieval(q, topK))
    );

    res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
