
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are a professional Amazon Listing Optimization Expert. Your goal is to maximize SEO and conversion.

[STRICT CONSTRAINTS]
1. TITLE: Max 200 characters.
2. BULLETS: Exactly 5 bullet points. Each bullet MUST start with a bolded Keyword. Each bullet point MAX 250 characters.
3. DESCRIPTION: Length between 1000 and 1700 characters. Use basic HTML (p, br, b).
4. NO-GO ZONE: Strictly NO Brand Names, NO Ad words (Best, Top, Sale), NO extreme words, and NO Car or Motorcycle brand names (BMW, Toyota, Honda, etc.).
5. MEASUREMENTS: Use FULL words for units (e.g., "Kilograms", "Centimeters").

Return ONLY a flat JSON object with keys: optimized_title, optimized_features (array), optimized_description, search_keywords, optimized_weight_value, optimized_weight_unit, optimized_length, optimized_width, optimized_height, optimized_size_unit.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = String(raw.optimized_title || "").slice(0, 200);
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  result.search_keywords = String(raw.search_keywords || "").slice(0, 250);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats.slice(0, 5).map((f: string) => String(f).slice(0, 250));
  while (result.optimized_features.length < 5) result.optimized_features.push("");

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
    3. KEEP Title under 200 chars. Keep each bullet under 250 chars.
    4. NO Car or Motorcycle Brands.
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

// Added editImageWithAI to handle AI-powered image editing tasks using gemini-2.5-flash-image
export const editImageWithAI = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned from AI response.");

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    throw new Error("The AI response did not contain an image part.");
  } catch (error: any) {
    throw new Error(`Gemini Image Editing Failed: ${error.message}`);
  }
};
