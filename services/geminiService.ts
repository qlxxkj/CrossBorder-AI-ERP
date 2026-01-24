
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
Act as a Senior Amazon SEO Specialist. Your mission is to re-engineer the product data to maximize conversion and search visibility.

[CRITICAL QUALITY RULES]
1. BRAND REMOVAL: Delete ALL original brands. NO car/motorcycle brands (Toyota, Tesla, etc.).
2. RADICAL TITLE REWRITE: Do NOT reuse the source title's word order. Use a completely fresh, high-CTR structure. Strictly MAX 150 characters.
3. 5 UNIQUE BULLET POINTS: 
   - Generate exactly 5 points.
   - Each point MUST cover a different product dimension: [1. Construction/Material], [2. Core Feature], [3. User Benefit], [4. Compatibility], [5. Care/Guarantee].
   - Points MUST be distinct from each other.
   - Format: Each must start with a bold "KEYWORD: " in all caps.
   - MAX 250 characters per point.
4. DESCRIPTION: Professional HTML. 1000-1700 characters.
5. SEARCH KEYWORDS: Highly relevant terms. STRICTLY MAX 200 characters total. Do not exceed 200.
6. INNOVATION: Produce a version that sounds fresh and premium, avoiding generic phrases.

Return ONLY a flat JSON object.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = String(raw.optimized_title || "").slice(0, 150);
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  
  // Rule: Search Keywords < 200 (Reduced from 250/300)
  result.search_keywords = String(raw.search_keywords || "").slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats
    .map((f: any) => String(f || "").trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: string) => {
      let s = f.slice(0, 250);
      if (!s.includes(":")) return "PREMIUM FEATURE: " + s;
      return s;
    });

  const fallbacks = [
    "DURABLE MATERIALS: Engineered with high-grade components for long-term reliability.",
    "ADVANCED DESIGN: Ergonomically optimized to provide a superior user experience.",
    "VERSATILE UTILITY: Perfect for a wide range of professional and home environments.",
    "EXCELLENT COMPATIBILITY: Designed to meet or exceed original equipment standards.",
    "SATISFACTION COMMITMENT: Our quality assurance ensures a risk-free purchase."
  ];
  while (result.optimized_features.length < 5) {
    result.optimized_features.push(fallbacks[result.optimized_features.length]);
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
      contents: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}\n\n[INSTRUCTION] Be creative. Ensure the title is drastically different from the source.`,
      config: { 
        responseMimeType: "application/json",
        temperature: 1.0 // Increased for higher variety
      }
    });
    const rawData = extractJSONObject(response.text || "{}");
    if (!rawData) throw new Error("Format error.");
    return normalizeOptimizedData(rawData);
  } catch (error: any) { throw new Error(`Gemini Error: ${error.message}`); }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Translate this to "${targetLangName}". JSON ONLY. Title<150, 5 UNIQUE Bullets<250, Keywords<200. NO brands. Data: ${JSON.stringify(sourceData)}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const rawData = extractJSONObject(response.text || "{}");
    return normalizeOptimizedData(rawData || {});
  } catch (error: any) { throw new Error(`Gemini Translation Error: ${error.message}`); }
};

export const editImageWithAI = async (base64: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      }
    });
    if (!response.candidates) throw new Error("No response");
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image returned");
  } catch (error: any) { throw new Error(`Gemini Image Edit Error: ${error.message}`); }
};
