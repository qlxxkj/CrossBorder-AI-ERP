
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert Amazon Listing Optimizer. Extract and optimize product data from:
    ${JSON.stringify(cleanedData)}

    [CORE TASKS]
    1. Title: Max 200 chars, SEO high-conversion.
    2. Bullets: Exactly 5 high-impact points. Start each with [KEYWORD].
    3. Description: 1000-1500 chars, use HTML (<p>, <br>).
    4. Logistics: 
       - Extract weight and dimensions. 
       - Standardize to English FULL NAMES: "pounds" and "inches".
       - Format numbers to 2 decimal places.
    
    Return valid JSON.
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
            search_keywords: { type: Type.STRING },
            optimized_weight_value: { type: Type.STRING },
            optimized_weight_unit: { type: Type.STRING },
            optimized_length: { type: Type.STRING },
            optimized_width: { type: Type.STRING },
            optimized_height: { type: Type.STRING },
            optimized_size_unit: { type: Type.STRING }
          },
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords", "optimized_weight_value", "optimized_weight_unit"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.trim()) as OptimizedData;
  } catch (error) {
    console.error("AI Optimization failed:", error);
    throw error;
  }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLang: string): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Translate and LOCALIZE this Amazon listing into the language of "${targetLang}".
    
    [CRITICAL - LOCALIZATION RULES]
    1. CONTENT: Translate Title, 5 Bullet Points, and Description naturally.
    2. UNIT SYSTEM: 
       - If ${targetLang} is for Metric markets (JP, DE, FR, IT, ES, MX, BR, CN): 
         CONVERT: "pounds" to "kilograms" (x0.45) and "inches" to "centimeters" (x2.54).
       - If ${targetLang} is for Imperial markets (US, CA, UK): Keep "pounds" and "inches".
    3. UNIT NAMES: Use FULL NAMES in ${targetLang}. NO abbreviations (no kg, lb, cm, in).
       - Examples: "キログラム", "センチメートル", "千克", "厘米".
    4. PRECISION: 2 decimal places for all numbers.

    Source Content: ${JSON.stringify(sourceData)}
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
            search_keywords: { type: Type.STRING },
            optimized_weight_value: { type: Type.STRING },
            optimized_weight_unit: { type: Type.STRING },
            optimized_length: { type: Type.STRING },
            optimized_width: { type: Type.STRING },
            optimized_height: { type: Type.STRING },
            optimized_size_unit: { type: Type.STRING }
          },
          required: ["optimized_title", "optimized_features", "optimized_description", "optimized_weight_value", "optimized_weight_unit", "optimized_length", "optimized_size_unit"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.trim()) as OptimizedData;
  } catch (error) {
    console.error(`Translation failed:`, error);
    throw error;
  }
};

export const editImageWithAI = async (imageBase64: string, instruction: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) return part.inlineData.data;
      }
    }
    throw new Error("No image generated.");
  } catch (error) { throw error; }
};
