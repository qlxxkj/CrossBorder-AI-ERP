import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    You are an expert Amazon Listing Optimizer. Your goal is to maximize SEO and conversion for the US marketplace.

    [CORE CONSTRAINTS]
    1. Title: SEO-rich, Max 200 characters. No brand names.
    2. Bullet Points: Exactly 5 points. EACH MUST START with a "[KEYWORD]: " prefix (e.g., "[DURABLE MATERIAL]: Made of high-quality...").
    3. Description: 1000-1500 characters. Use HTML tags like <p> and <br>. Focus on benefits.
    4. Logistics Extraction:
       - 'optimized_weight_value': Pure number string from source (e.g., "3.5").
       - 'optimized_weight_unit': MUST be full English name ("Pounds" or "Ounces").
       - 'optimized_length', 'optimized_width', 'optimized_height': Pure number strings.
       - 'optimized_size_unit': MUST be full English name ("Inches").
    5. STRICTURES: NO Brand Names, NO extreme words like "Best" or "Perfect". No automotive brand mentions.

    [SOURCE DATA]
    ${JSON.stringify(cleanedData)}

    Rewrite and enhance the content. Return ONLY JSON.
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
            optimized_features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of 5 bullet points starting with [KEYWORD]: " },
            optimized_description: { type: Type.STRING },
            search_keywords: { type: Type.STRING },
            optimized_weight_value: { type: Type.STRING },
            optimized_weight_unit: { type: Type.STRING },
            optimized_length: { type: Type.STRING },
            optimized_width: { type: Type.STRING },
            optimized_height: { type: Type.STRING },
            optimized_size_unit: { type: Type.STRING }
          },
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords"]
        }
      }
    });
    
    const data = JSON.parse(response.text || "{}") as OptimizedData;
    // 补齐 5 个五点描述，确保不为空
    if (!data.optimized_features || data.optimized_features.length === 0) {
      data.optimized_features = (cleanedData.features || []).slice(0, 5).map(f => `[FEATURES]: ${f}`);
    }
    while (data.optimized_features.length < 5) data.optimized_features.push("");
    
    return data;
  } catch (error) { throw error; }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Translate this Amazon listing to "${targetLangName}". 
    Maintain HTML tags in description. 
    Keep the "[KEYWORD]: " prefix style in bullet points (translate the content and the keyword).
    Source: ${JSON.stringify(sourceData)}
  `;
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