import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  if (!apiKey) throw new Error("API Key is missing.");

  const prompt = `
    You are an expert Amazon Listing Optimizer.
    Analyze the following product data and generate an optimized listing in English including:
    1. An SEO-friendly Title (max 200 chars).
    2. 5 high-converting Bullet Points (Features) with emojis at the start.
    3. An engaging Description.
    4. Backend Search Keywords (comma separated).

    Input Data:
    ${JSON.stringify(cleanedData)}
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

    return JSON.parse(response.text) as OptimizedData;
  } catch (error) {
    console.error("AI Optimization failed:", error);
    throw error;
  }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLang: string): Promise<OptimizedData> => {
  if (!apiKey) throw new Error("API Key is missing.");

  const prompt = `
    Translate the following Amazon listing content into ${targetLang}. 
    Maintain the SEO keywords, formatting, and high-conversion tone.
    Output only JSON.

    Source Content:
    ${JSON.stringify(sourceData)}
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

    return JSON.parse(response.text) as OptimizedData;
  } catch (error) {
    console.error(`Translation to ${targetLang} failed:`, error);
    throw error;
  }
};

export const editImageWithAI = async (imageBase64: string, instruction: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing.");
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: instruction }
        ]
      }
    });
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) return part.inlineData.data;
      }
    }
    throw new Error("No image generated.");
  } catch (error) {
    console.error("AI Image Edit failed:", error);
    throw error;
  }
};