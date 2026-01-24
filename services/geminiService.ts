
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are a professional Amazon Listing Optimization Expert. Your goal is to maximize SEO and conversion.

[STRICT CONSTRAINTS]
1. REMOVE ALL BRAND NAMES: Strictly NO Brand Names from the source data. DO NOT mention the original brand. NO famous Car or Motorcycle brands (BMW, Toyota, Honda, etc.).
2. TITLE: Compelling title under 200 characters.
3. BULLETS: Exactly 5 bullet points. EVERY point must have content. Each bullet MUST start with a capitalized KEYWORD followed by a colon. Max 250 characters per bullet point.
4. DESCRIPTION: Length between 1000 and 1700 characters. Use basic HTML (<p>, <br>, <b>).
5. SEARCH KEYWORDS: Generate high-traffic backend keywords. DO NOT leave this empty. Max 300 characters total.
6. NO-GO ZONE: No Ad words (Best, Top, Sale), no extreme words ("#1", "Greatest").
7. MEASUREMENTS: Use FULL words for units (e.g., "Kilograms", "Centimeters").

Return ONLY a flat JSON object with keys: optimized_title, optimized_features (array of 5 strings), optimized_description, search_keywords, optimized_weight_value, optimized_weight_unit, optimized_length, optimized_width, optimized_height, optimized_size_unit.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = String(raw.optimized_title || "").slice(0, 200);
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  // Support 300 characters for keywords as requested
  result.search_keywords = String(raw.search_keywords || "").slice(0, 300);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  // Ensure we have exactly 5 non-empty bullets
  result.optimized_features = feats
    .map((f: any) => String(f || "").trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: string) => f.slice(0, 250));

  while (result.optimized_features.length < 5) {
    result.optimized_features.push("High quality product designed for durability and performance.");
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
    // Provide source data but tell AI to ignore the brand field
    const sourceCopy = { ...cleanedData };
    delete sourceCopy.brand;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA (STRICTLY NO BRAND)]\n${JSON.stringify(sourceCopy)}`,
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
    3. KEEP Title under 200 chars. Keep each of the 5 bullets under 250 chars.
    4. NO Car or Motorcycle Brands. Ensure search_keywords is translated and under 300 chars.
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
