
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are an expert Amazon Listing Optimizer. Your goal is to maximize SEO and conversion.

[STRICT CONSTRAINTS]
1. Keys: optimized_title, optimized_features (array of 5-10), optimized_description, search_keywords.
2. Measurements: optimized_weight_value, optimized_weight_unit, optimized_length, optimized_width, optimized_height, optimized_size_unit.
3. [IMPORTANT] Units: Always use full words for units in the TARGET language. 
   - For English/Latin: Sentence Case (e.g., "Kilograms", "Centimeters").
   - For Japan: Use Japanese characters (e.g., "キログラム", "センチメートル").
   - For Arabic: Use Arabic script (e.g., "كيلوجرام").
   - For Mexico/Brazil: Use Spanish/Portuguese (e.g., "Kilogramos", "Centímetros").
4. PROHIBITED: 
   - No Brand Names.
   - NO Car or Motorcycle Brand Names (e.g., BMW, Toyota, Mercedes, Tesla, Honda, Yamaha, Kawasaki, Ducati, etc.) to avoid trademark issues.
   - No Extreme Words (Best, Perfect, etc.).

Return ONLY a flat JSON object.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = raw.optimized_title || raw.title || "";
  result.optimized_description = raw.optimized_description || raw.description || "";
  result.search_keywords = raw.search_keywords || raw.keywords || "";
  let feats = raw.optimized_features || raw.features || raw.bullet_points || [];
  if (typeof feats === 'string') feats = feats.split('\n').map(s => s.trim().replace(/^[-*•\d.]+\s*/, '')).filter(Boolean);
  if (!Array.isArray(feats)) feats = [];
  const finalFeats = ["", "", "", "", ""];
  feats.forEach((f, i) => { if(i < 10) finalFeats[i] = String(f); });
  result.optimized_features = finalFeats.filter(Boolean);
  if (result.optimized_features.length < 5) {
    while(result.optimized_features.length < 5) result.optimized_features.push("");
  }
  
  result.optimized_weight_value = String(raw.optimized_weight_value || raw.weight_value || "");
  result.optimized_weight_unit = String(raw.optimized_weight_unit || raw.weight_unit || "");
  result.optimized_length = String(raw.optimized_length || raw.length || "");
  result.optimized_width = String(raw.optimized_width || raw.width || "");
  result.optimized_height = String(raw.optimized_height || raw.height || "");
  result.optimized_size_unit = String(raw.optimized_size_unit || raw.size_unit || "");
  
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}`,
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
    3. NO Car or Motorcycle Brands.
    4. [UNIT RULE]: Use the FULL NAME of the unit in the "${targetLangName}" language.
       - Japanese: "キログラム", "センチメートル".
       - Arabic: "كيلوجرام".
       - Spanish/Portuguese: "Kilogramos", "Centímetros".
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
      contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: prompt }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image data.");
  } catch (error: any) { throw error; }
};
