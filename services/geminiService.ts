import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    You are an expert Amazon Listing Optimizer. Your goal is to maximize SEO and conversion for the US marketplace.

    [STRICT CONSTRAINTS]
    1. Title: Max 200 characters. SEO-rich, no brand names.
    2. Bullet Points: Exactly 5 points. Each point MUST start with a "[KEYWORD]: " prefix (e.g., "[DURABLE MATERIAL]: Made of...").
    3. Description: 1000-1500 characters. Use HTML tags like <p> and <br>.
    4. Measurements (US Standard): 
       - Standardize weight and dimensions found in source.
       - 'optimized_weight_value': Pure number string.
       - 'optimized_weight_unit': Use "Pounds" or "Ounces".
       - 'optimized_length', 'optimized_width', 'optimized_height': Pure number strings.
       - 'optimized_size_unit': Use "Inches".
    5. PROHIBITED: No Brand Names, No Extreme Words (Best, Perfect, etc.).

    [SOURCE DATA]
    ${JSON.stringify(cleanedData)}

    Return ONLY JSON matching the schema.
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
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords"]
        }
      }
    });
    
    const data = JSON.parse(response.text || "{}") as OptimizedData;
    // 补齐五点描述
    if (!data.optimized_features || data.optimized_features.length === 0) {
      data.optimized_features = (cleanedData.features || []).slice(0, 5).map(f => `[FEATURES]: ${f}`);
    }
    while (data.optimized_features.length < 5) data.optimized_features.push("");
    return data;
  } catch (error) { throw error; }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Translate this Amazon listing to "${targetLangName}". Keep HTML tags and "[KEYWORD]: " bullet point style. Source: ${JSON.stringify(sourceData)}`;
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