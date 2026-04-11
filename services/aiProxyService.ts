import { CleanedData, OptimizedData } from "../types";
import { optimizeListingWithAI, translateListingWithAI } from "./geminiService";
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from "./openaiService";
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from "./deepseekService";
import { optimizeListingWithQwen, translateListingWithQwen } from "./qwenService";

export const optimizeListingProxy = async (
  engine: 'gemini' | 'openai' | 'deepseek' | 'qwen',
  cleanedData: CleanedData,
  infringementWords: string[] = []
): Promise<{ data: OptimizedData; tokens: number }> => {
  console.log(`🔥 [AI Proxy] Optimizing with ${engine} (Client-Side)`);
  
  if (engine === 'openai') {
    return await optimizeListingWithOpenAI(cleanedData, infringementWords);
  } else if (engine === 'deepseek') {
    return await optimizeListingWithDeepSeek(cleanedData, infringementWords);
  } else if (engine === 'qwen') {
    return await optimizeListingWithQwen(cleanedData, infringementWords);
  } else {
    return await optimizeListingWithAI(cleanedData, infringementWords);
  }
};

export const translateListingProxy = async (
  engine: 'gemini' | 'openai' | 'deepseek' | 'qwen',
  sourceData: OptimizedData,
  targetLangName: string
): Promise<{ data: Partial<OptimizedData>; tokens: number }> => {
  console.log(`🔥 [AI Proxy] Translating with ${engine} (Client-Side)`);
  
  if (engine === 'openai') {
    return await translateListingWithOpenAI(sourceData, targetLangName);
  } else if (engine === 'deepseek') {
    return await translateListingWithDeepSeek(sourceData, targetLangName);
  } else if (engine === 'qwen') {
    return await translateListingWithQwen(sourceData, targetLangName);
  } else {
    return await translateListingWithAI(sourceData, targetLangName);
  }
};
