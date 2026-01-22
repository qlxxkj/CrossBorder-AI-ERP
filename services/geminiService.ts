import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert Amazon Listing Optimizer. Optimize product data:
    ${JSON.stringify(cleanedData)}

    [CORE REQUIREMENTS]
    1. Title: Create an SEO-rich title (max 200 chars).
    2. Bullets: Provide EXACTLY 5 high-impact bullet points.
       - Each point MUST be UNDER 250 characters.
       - Each point MUST start with a [KEYWORD] or [PHRASE] in brackets.
    3. Description: persuasive HTML description (1000-1500 chars).
    
    [STRICT PROHIBITIONS - CRITICAL]
    - NO BRAND NAMES: Absolutely no brands (including "Bosch", "Nike", etc.).
    - NO AUTOMOTIVE BRANDS: No "Toyota", "Tesla", "Honda", etc. Use generic compatibility terms.
    - NO EXTREME WORDS: No "Best", "Ultimate", "Perfect", "Top-rated", "Number 1".
    
    Return ONLY valid JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimized_title: { type: Type.STRING },
            optimized_features: { type: Type.ARRAY, items: { type: Type.STRING } },
            optimized_description: { type: Type.STRING },
            search_keywords: { type: Type.STRING }
          },
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}") as OptimizedData;
    if (data.optimized_features && data.optimized_features.length < 5) {
      while (data.optimized_features.length < 5) data.optimized_features.push("");
    }
    return data;
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    throw error;
  }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Translate to "${targetLang}". Keep [KEYWORD] prefix. NO brands. Source: ${JSON.stringify(sourceData)}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { throw error; }
};

export const editImageWithAI = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image data");
  } catch (error) { throw error; }
};