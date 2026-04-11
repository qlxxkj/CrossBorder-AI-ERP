import { CleanedData, OptimizedData } from "../types";

export const optimizeListingProxy = async (
  engine: 'gemini' | 'openai' | 'deepseek' | 'qwen',
  cleanedData: CleanedData,
  infringementWords: string[] = []
): Promise<{ data: OptimizedData; tokens: number }> => {
  console.log(`🚀 [AI Proxy] Optimizing with ${engine} via Edge Function`);
  
  const response = await fetch("/api/ai/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, cleanedData, infringementWords })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Edge Error: ${response.status}`);
  }

  const rawData = await response.json();
  return { data: rawData.data as OptimizedData, tokens: rawData.tokens || 0 };
};

export const translateListingProxy = async (
  engine: 'gemini' | 'openai' | 'deepseek' | 'qwen',
  sourceData: OptimizedData,
  targetLangName: string
): Promise<{ data: Partial<OptimizedData>; tokens: number }> => {
  console.log(`🚀 [AI Proxy] Translating with ${engine} via Edge Function`);
  
  const response = await fetch("/api/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engine, sourceData, targetLangName })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Edge Error: ${response.status}`);
  }

  const rawData = await response.json();
  return { data: rawData.data as Partial<OptimizedData>, tokens: rawData.tokens || 0 };
};
