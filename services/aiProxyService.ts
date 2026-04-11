import { CleanedData, OptimizedData } from "../types";
import { optimizeListingWithAI, translateListingWithAI } from "./geminiService";

export const optimizeListingProxy = async (
  engine: 'gemini' | 'openai' | 'deepseek' | 'qwen',
  cleanedData: CleanedData,
  infringementWords: string[] = []
): Promise<{ data: OptimizedData; tokens: number }> => {
  if (engine === 'gemini') {
    return await optimizeListingWithAI(cleanedData, infringementWords);
  }

  // Call backend for other engines to avoid CORS and hide keys
  const response = await fetch("/api/ai/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, cleanedData, infringementWords })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Backend Error: ${response.status}`);
  }

  return await response.json();
};

export const translateListingProxy = async (
  engine: 'gemini' | 'openai' | 'deepseek' | 'qwen',
  sourceData: OptimizedData,
  targetLangName: string
): Promise<{ data: Partial<OptimizedData>; tokens: number }> => {
  if (engine === 'gemini') {
    return await translateListingWithAI(sourceData, targetLangName);
  }

  // Call backend for other engines
  const response = await fetch("/api/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, sourceData, targetLangName })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Backend Error: ${response.status}`);
  }

  return await response.json();
};
