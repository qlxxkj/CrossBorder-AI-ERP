
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are an expert Amazon Listing Optimizer. Your goal is to maximize SEO and conversion for the US marketplace.

[STRICT CONSTRAINTS]
1. optimized_title: Max 200 characters. SEO-rich, no brand names.
2. optimized_features: Array of exactly 5 strings. Each MUST start with a "[KEYWORD]: " prefix.
3. optimized_description: 1000-1500 characters. Use HTML tags like <p> and <br>.
4. search_keywords: High-volume relevant terms.
5. Measurements (US Standard): 
   - optimized_weight_value: Pure number string.
   - optimized_weight_unit: "Pounds" or "Ounces".
   - optimized_length, optimized_width, optimized_height: Pure number strings.
   - optimized_size_unit: "Inches".
6. PROHIBITED: No Brand Names, No Extreme Words (Best, Perfect, etc.).

Return ONLY a flat JSON object matching these keys.
`;

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}`,
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
    
    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text) as OptimizedData;
    
    if (!data.optimized_features || !Array.isArray(data.optimized_features)) {
      data.optimized_features = [];
    }
    while (data.optimized_features.length < 5) data.optimized_features.push("");
    return data;
  } catch (error) { throw error; }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Translate this Amazon listing to "${targetLangName}". 
    [STRICT]: 
    1. Keep HTML tags.
    2. Maintain "[KEYWORD]: " style for bullets.
    3. IMPORTANT: Translate measurement units (e.g. Kilograms, Centimeters) into the target language of the marketplace (e.g., 'كيلوجرام' for Arabic, 'Kilogramm' for German).
    Return ONLY flat JSON. 
    Source: ${JSON.stringify(sourceData)}
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
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
