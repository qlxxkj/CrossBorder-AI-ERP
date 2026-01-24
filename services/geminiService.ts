
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are a professional Amazon Listing Optimization Expert. Your goal is to maximize SEO and conversion.

[STRICT CONSTRAINTS]
1. REMOVE ALL BRAND NAMES: Strictly NO Brand Names. DO NOT mention the original brand. NO famous Car or Motorcycle brands (BMW, Toyota, Honda, Ford, etc.).
2. TITLE: Max 150 characters.
3. BULLETS: Exactly 5 points. Every point must start with a CAPITALIZED KEYWORD. Max 250 characters per bullet point.
4. DESCRIPTION: Between 1000 and 1700 characters. Use basic HTML (<p>, <br>, <b>).
5. SEARCH KEYWORDS: Max 300 characters.
6. NO-GO ZONE: No Ad words (Best, Top, Sale), no extreme words ("#1", "Greatest").
7. MEASUREMENTS: Use FULL words for units (e.g., "Kilograms", "Centimeters").

Return ONLY a flat JSON object with keys: optimized_title, optimized_features (array of 5 strings), optimized_description, search_keywords, optimized_weight_value, optimized_weight_unit, optimized_length, optimized_width, optimized_height, optimized_size_unit.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = String(raw.optimized_title || "").slice(0, 150);
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  result.search_keywords = String(raw.search_keywords || "").slice(0, 300);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats
    .map((f: any) => String(f || "").trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: string) => f.slice(0, 250));

  while (result.optimized_features.length < 5) {
    result.optimized_features.push("High quality material ensures long-lasting durability for daily use.");
  }

  result.optimized_weight_value = String(raw.optimized_weight_value || "");
  result.optimized_weight_unit = String(raw.optimized_weight_unit || "");
  result.optimized_length = String(raw.optimized_length || "");
  result.optimized_width = String(raw.optimized_width || "");
  result.optimized_height = String(raw.optimized_height || "");
  result.optimized_size_unit = String(raw.optimized_size_unit || "");
  
  return result as OptimizedData;
};

const extractJSONObject = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) { return null; }
};

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const sourceCopy = { ...cleanedData };
    delete sourceCopy.brand;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}`,
      config: { responseMimeType: "application/json" }
    });
    const rawData = extractJSONObject(response.text || "{}");
    if (!rawData) throw new Error("Invalid AI Response format.");
    return normalizeOptimizedData(rawData);
  } catch (error: any) { throw new Error(`Gemini Optimization Failed: ${error.message}`); }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Task: Translate this Amazon listing to "${targetLangName}". 
    [STRICT RULES]: 
    1. KEEP ALL JSON KEYS UNCHANGED.
    2. RETURN ONLY JSON. 
    3. Title < 150 chars. 5 Bullets < 250 chars. Keywords < 300 chars.
    4. NO Brands or Car/Moto names.
    5. Translate units to FULL words in "${targetLangName}".
    Data: ${JSON.stringify(sourceData)}
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const rawData = extractJSONObject(response.text || "{}");
    return normalizeOptimizedData(rawData || {});
  } catch (error: any) { throw new Error(`Gemini Translation Failed: ${error.message}`); }
};

export const editImageWithAI = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      }
    });
    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned.");
    for (const part of candidate.content.parts) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image part found.");
  } catch (error: any) { throw new Error(`Image Editing Failed: ${error.message}`); }
};
