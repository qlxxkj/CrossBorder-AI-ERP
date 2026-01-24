
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are a professional Amazon SEO Specialist. Rewrite the product data for maximum conversion.

[STRICT CONSTRAINTS]
1. REMOVE ALL BRAND NAMES: Delete original brands. NO car/motorcycle brands (Toyota, Tesla, BMW, etc.).
2. TITLE: Create a FRESH, high-click-rate title. Strictly MAX 150 characters. Do NOT use the old title structure.
3. 5 UNIQUE BULLET POINTS: 
   - Exactly 5 points. 
   - Each MUST cover a DIFFERENT aspect (e.g., Quality, Versatility, Design, Compatibility, Value). 
   - Each MUST start with a bolded "KEYWORD:". 
   - They MUST NOT be identical or even similar.
   - Strictly MAX 250 characters per point.
4. DESCRIPTION: Length 1000 - 1700 characters. Use basic HTML (<p>, <br>, <b>).
5. SEARCH KEYWORDS: Highly relevant SEO terms. MAX 300 characters.
6. NO AD WORDS: No "Best", "#1", "Sale".
7. JSON: Return ONLY a flat JSON object. No Markdown.
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

  // If AI fails to provide 5 unique points, fill with generic but unique fallbacks
  const fallbacks = [
    "DURABLE CONSTRUCTION: Built with premium materials for long-lasting use.",
    "SLEEK DESIGN: Modern aesthetic that complements any setting or decor.",
    "EASY INSTALLATION: Simple setup process that saves you time and effort.",
    "VERSATILE UTILITY: Perfect for a wide range of professional or personal applications.",
    "CUSTOMER SATISFACTION: Committed to high standards of quality and performance."
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
      contents: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}`,
      config: { 
        responseMimeType: "application/json",
        temperature: 1.0 // High variety
      }
    });
    const rawData = extractJSONObject(response.text || "{}");
    if (!rawData) throw new Error("Format error.");
    return normalizeOptimizedData(rawData);
  } catch (error: any) { throw new Error(`Gemini Optimization Error: ${error.message}`); }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Translate this to "${targetLangName}". FLAT JSON ONLY. 150-char title, 5 UNIQUE 250-char bullets, 300-char keywords. NO brands. Data: ${JSON.stringify(sourceData)}`;
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

// Fix: Added the missing editImageWithAI function export
/**
 * Edits an image using Gemini AI.
 * @param base64 The base64 encoded image string (data only, no prefix).
 * @param prompt The prompt instructions for editing the image.
 * @returns The base64 encoded string of the edited image.
 */
export const editImageWithAI = async (base64: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Empty response from AI");
    }

    // Fix: Iterate through all parts to find the image part as per guidelines
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    throw new Error("No image part returned from Gemini");
  } catch (error: any) {
    throw new Error(`Gemini Image Edit Error: ${error.message}`);
  }
};
