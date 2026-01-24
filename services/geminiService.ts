
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = (Brand: string, timestamp: number) => `
Act as a Senior Amazon SEO Specialist. Your goal is to REWRITE the product data to maximize conversion.
[INTERNAL_SEED: ${timestamp}] 

[CRITICAL BRAND REMOVAL]
1. DELETE BRAND: Completely remove "${Brand}" and all its variants (e.g., "${Brand.toUpperCase()}", "${Brand.toLowerCase()}") from all fields.
2. DELETE TRADEMARKS: No automotive brand names (Toyota, BMW, Tesla, Ford, etc.) or generic manufacturer marks.
3. NO AD WORDS: No "Best", "Top-rated", "Sale".

[CONTENT STRUCTURE]
1. RADICAL TITLE REWRITE: Do NOT reuse the source title's word order. Use a COMPLETELY FRESH structure. Create a compelling, high-CTR version. MAX 150 characters.
2. 5 UNIQUE BULLET POINTS: 
   - Generate exactly 5 points.
   - Each MUST cover a different dimension: [Material/Quality], [Core Design], [Key Benefit], [Usage/Compatibility], [Service/Guarantee].
   - Points MUST be distinct. Each must start with a bold "KEYWORD: " in all caps.
   - MAX 300 characters per point.
3. DESCRIPTION: Professional HTML. 1200-1700 characters.
4. SEARCH KEYWORDS: Highly relevant terms. STRICTLY MAX 200 characters total.

Return ONLY a flat JSON object.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  
  // Safe string extractor to prevent [object Object]
  const extractText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text || val.content || val.value || JSON.stringify(val);
    return String(val || "");
  };

  result.optimized_title = extractText(raw.optimized_title).slice(0, 150);
  result.optimized_description = extractText(raw.optimized_description).slice(0, 1700);
  result.search_keywords = extractText(raw.search_keywords).slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats
    .map((f: any) => extractText(f).trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: string) => {
      let s = f.slice(0, 300);
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

  result.optimized_weight_value = extractText(raw.optimized_weight_value);
  result.optimized_weight_unit = extractText(raw.optimized_weight_unit);
  result.optimized_length = extractText(raw.optimized_length);
  result.optimized_width = extractText(raw.optimized_width);
  result.optimized_height = extractText(raw.optimized_height);
  result.optimized_size_unit = extractText(raw.optimized_size_unit);
  
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
    const brandToKill = cleanedData.brand || "UNKNOWN_BRAND";
    const sourceCopy = { ...cleanedData };
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: UNIFIED_OPTIMIZE_PROMPT(brandToKill, Date.now()) + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}\n\n[TASK] Completely rewrite the title. Avoid old structure.`,
      config: { 
        responseMimeType: "application/json",
        temperature: 1.0 
      }
    });
    const rawData = extractJSONObject(response.text || "{}");
    if (!rawData) throw new Error("Format error.");
    return normalizeOptimizedData(rawData);
  } catch (error: any) { throw new Error(`Gemini Error: ${error.message}`); }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Translate to "${targetLangName}". JSON ONLY. Title<150, 5 UNIQUE Bullets<300, Keywords<200. NO brands. Data: ${JSON.stringify(sourceData)}`;
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
