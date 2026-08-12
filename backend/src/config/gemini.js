import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const googleAIModel = (options = {}) => {
  return genAI.getGenerativeModel({
    model: "gemini-flash-lite-latest", // Uses the current active Flash alias
    ...options,
  });
};