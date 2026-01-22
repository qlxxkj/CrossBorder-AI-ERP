import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    You are an expert Amazon Listing Optimizer. 
    Source Data: ${JSON.stringify(cleanedData)}

    [CORE REQUIREMENTS]
    1. Title: SEO-rich, max 200 chars.
    2. Bullets: Exactly 5 points. EACH UNDER 250 CHARACTERS.
    3. Description: HTML format.
    4. Logistics Extraction (CRITICAL): 
       - Find weight and dimensions in the source.
       - 'optimized_weight_value': Pure number string (e.g. "3.5").
       - 'optimized_weight_unit': Standard full word (e.g. "Pounds", "Kilograms").
       - 'optimized_length', 'optimized_width', 'optimized_height': Pure number strings.
       - 'optimized_size_unit': Standard full word (e.g. "Inches", "Centimeters").
    
    Return ONLY JSON.
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
          }
        }
      }
    });
    
    const data = JSON.parse(response.text || "{}") as OptimizedData;
    if (data.optimized_features && data.optimized_features.length < 5) {
      while (data.optimized_features.length < 5) data.optimized_features.push("");
    }
    return data;
  } catch (error) { throw error; }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Translate this Amazon listing to "${targetLangName}". Maintain HTML tags. Source: ${JSON.stringify(sourceData)}`;
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