
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = (Brand: string, timestamp: number) => `
Act as a Senior Amazon Listing Expert. REWRITE the product data for maximum conversion.
[UNIQUE_SESSION_ID: ${timestamp}] 

[CRITICAL REMOVAL]
1. DELETE BRAND: Completely remove "${Brand}" and variants like "${Brand.toUpperCase()}".
2. NO TRADEMARKS: No Toyota, BMW, Tesla, Honda, etc. Retain the vehicle model and OE number.

[CONTENT REQUIREMENTS]
1. RADICAL REWRITE: Generate a COMPLETELY NEW title structure. Do NOT use the same word order as the source. Use high-converting synonyms. MAX 150 characters.
2. 5 DISTINCT BULLETS: 5 unique points. Each MUST start with "UPPERCASE_KEYWORD: ". 
   - Points must cover: [Material], [Design], [Usage], [Compatibility], [Guarantee].
   - MAX 300 characters each.
3. DESCRIPTION: Pro HTML. 1200-1700 characters.
4. SEARCH KEYWORDS: Highly relevant. STRICTLY MAX 200 characters total.

Return ONLY a flat JSON object with these EXACT keys: 
"optimized_title", "optimized_features", "optimized_description", "search_keywords".
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  
  const extractText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text || val.content || val.value || val.string || JSON.stringify(val);
    return "";
  };

  // Robust field mapping with aliases
  result.optimized_title = extractText(raw.optimized_title || raw.title || raw.product_title || "").slice(0, 150);
  result.optimized_description = extractText(raw.optimized_description || raw.description || raw.product_description || "").slice(0, 1700);
  result.search_keywords = extractText(raw.search_keywords || raw.keywords || raw.optimized_search_keywords || "").slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : 
              Array.isArray(raw.features) ? raw.features : 
              Array.isArray(raw.bullet_points) ? raw.bullet_points : [];

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

  result.optimized_weight_value = extractText(raw.optimized_weight_value || raw.item_weight_value || "");
  result.optimized_weight_unit = extractText(raw.optimized_weight_unit || raw.item_weight_unit || "");
  result.optimized_length = extractText(raw.optimized_length || raw.item_length || "");
  result.optimized_width = extractText(raw.optimized_width || raw.item_width || "");
  result.optimized_height = extractText(raw.optimized_height || raw.item_height || "");
  result.optimized_size_unit = extractText(raw.optimized_size_unit || raw.item_size_unit || "");
  
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
  const prompt = `Translate to "${targetLangName}". JSON ONLY. Use keys: optimized_title, optimized_features, optimized_description, search_keywords. NO brands. Data: ${JSON.stringify(sourceData)}`;
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
