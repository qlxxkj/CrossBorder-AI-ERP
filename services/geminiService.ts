import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert Amazon Listing Optimizer. Extract and optimize product data from:
    ${JSON.stringify(cleanedData)}

    [CORE REQUIREMENTS]
    1. Title: Create an SEO-rich title (max 200 chars).
    2. Bullets (Features): Provide EXACTLY 5 high-impact bullet points.
       - Each point MUST be UNDER 250 characters.
       - Each point MUST start with a [KEYWORD] or [PHRASE] in brackets.
    3. Description: Write a persuasive product description (1000-1500 chars) using basic HTML.
    4. Search Keywords: Provide 250 characters of high-converting search terms.
    
    [STRICT PROHIBITIONS - CRITICAL]
    - NO BRAND NAMES: Do not include ANY brand names (including the source brand).
    - NO EXTREME WORDS: Avoid superlatives like "best", "perfect", "ultimate", "top-rated".
    - NO AUTOMOTIVE BRANDS: Absolutely no car brands (e.g., Toyota, Honda, Ford, etc.). Use "compatible with select vehicles" instead.
    
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
            optimized_features: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Exactly 5 bullet points, max 250 chars each, starts with [KEYWORD]"
            },
            optimized_description: { type: Type.STRING },
            search_keywords: { type: Type.STRING }
          },
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords"]
        }
      }
    });

    const text = response.text || "{}";
    const data = JSON.parse(text.trim()) as OptimizedData;
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
  const prompt = `Translate and LOCALIZE this Amazon listing into "${targetLang}". Keep the [KEYWORD] prefix format for bullets. No brand names. Source: ${JSON.stringify(sourceData)}`;
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
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    throw error;
  }
};

export const editImageWithAI = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }]
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image data");
  } catch (error) { throw error; }
};