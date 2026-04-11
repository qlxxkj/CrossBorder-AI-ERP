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
  const apiUrl = "/api/ai/optimize";
  const fullUrl = new URL(apiUrl, window.location.origin).href;
  console.log(`[AI Proxy] Optimizing with ${engine}. Fetching from: ${fullUrl}`);
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, cleanedData, infringementWords })
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || `Backend Error: ${response.status}`);
    } else {
      const text = await response.text();
      console.error("Non-JSON Error Response (Optimize):", text);
      throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}...`);
    }
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
  const apiUrl = "/api/ai/translate";
  const fullUrl = new URL(apiUrl, window.location.origin).href;
  console.log(`[AI Proxy] Translating with ${engine}. Fetching from: ${fullUrl}`);
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, sourceData, targetLangName })
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const err = await response.json();
      throw new Error(err.error || `Backend Error: ${response.status}`);
    } else {
      const text = await response.text();
      console.error("Non-JSON Error Response (Translate):", text);
      throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}...`);
    }
  }

  return await response.json();
};
