
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are an Amazon Listing SEO Expert. Your task is to re-write and optimize the product data for maximum conversion.

[STRICT CONSTRAINTS]
1. REMOVE ALL BRAND NAMES: Delete original brands and NO automotive brands (BMW, Audi, etc.).
2. TITLE: Create a fresh, compelling title. Strictly MAX 150 characters.
3. 5 BULLET POINTS: Exactly 5 points. Each MUST start with a capitalized "KEYWORD:". MAX 250 characters per point.
4. DESCRIPTION: Length between 1000 and 1700 characters. Use valid HTML (<p>, <br>, <b>).
5. SEARCH KEYWORDS: Highly relevant terms. Strictly MAX 300 characters.
6. NO AD WORDS: No "Best", "#1", "New", "Sale".
7. VARIATION: Do not just copy-paste. Use professional synonyms to create a unique version every time.

Return ONLY a flat JSON object.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  // Rule 1: Title < 150
  result.optimized_title = String(raw.optimized_title || "").slice(0, 150);
  // Rule 3: Description 1000-1700
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  // Rule 4: Keywords < 300
  result.search_keywords = String(raw.search_keywords || "").slice(0, 300);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  // Rule 2: 5 Bullets < 250
  result.optimized_features = feats
    .map((f: any) => String(f || "").trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: string) => f.slice(0, 250));

  while (result.optimized_features.length < 5) {
    result.optimized_features.push("Reliable performance: Engineered for durability and consistent quality results.");
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
    delete sourceCopy.brand; // Absolute removal

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}\n\n[INSTRUCTION] Generate a NEW unique version different from standard descriptions.`,
      config: { 
        responseMimeType: "application/json",
        temperature: 0.9 // Higher temperature to ensure variation on re-clicks
      }
    });
    const rawData = extractJSONObject(response.text || "{}");
    if (!rawData) throw new Error("Invalid Response.");
    return normalizeOptimizedData(rawData);
  } catch (error: any) { throw new Error(`Gemini Error: ${error.message}`); }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Translate to "${targetLangName}". 
    [RULES]: 
    1. FLAT JSON. 
    2. Title < 150 chars. 5 Bullets < 250 chars. Keywords < 300 chars.
    3. NO Brands. NO Car brands.
    4. Units to FULL words in "${targetLangName}".
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
  } catch (error: any) { throw new Error(`Gemini Translation Error: ${error.message}`); }
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
    if (!candidate) throw new Error("No candidates.");
    for (const part of candidate.content.parts) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image part.");
  } catch (error: any) { throw new Error(`Image Edit Error: ${error.message}`); }
};
