
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

const UNIFIED_OPTIMIZE_PROMPT = `
You are an expert Amazon Listing Optimizer. Your goal is to maximize SEO and conversion for the US marketplace.

[STRICT CONSTRAINTS]
1. optimized_title: Max 200 characters. SEO-rich.
2. optimized_features: Array of exactly 5 strings.
3. optimized_description: 1000-1500 characters. Use HTML tags.
4. search_keywords: High-volume terms.
5. Measurements: 
   - optimized_weight_value, optimized_weight_unit, optimized_length, optimized_width, optimized_height, optimized_size_unit.

Return ONLY a flat JSON object matching these exact keys.
`;

// 强力归一化：不进行 Master 填充，仅进行 Key 映射
const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  
  // 映射标题
  result.optimized_title = raw.optimized_title || raw.title || raw.product_title || "";
  
  // 映射描述
  result.optimized_description = raw.optimized_description || raw.description || raw.desc || raw.product_description || "";
  
  // 映射关键词
  result.search_keywords = raw.search_keywords || raw.keywords || raw.tags || raw.search_terms || "";
  
  // 映射五点 (强制转为数组并过滤空值)
  let feats = raw.optimized_features || raw.features || raw.bullet_points || raw.bullets || [];
  if (typeof feats === 'string') {
    feats = feats.split('\n').map(s => s.trim().replace(/^[-*•\d.]+\s*/, '')).filter(Boolean);
  }
  if (!Array.isArray(feats)) feats = [];
  // 保证 5 个槽位，但如果 raw 里没给，这里就留空，方便用户排查
  const finalFeats = ["", "", "", "", ""];
  feats.slice(0, 5).forEach((f, i) => finalFeats[i] = String(f));
  result.optimized_features = finalFeats;
  
  // 映射物流尺寸
  result.optimized_weight_value = String(raw.optimized_weight_value || raw.weight_value || raw.weight || "");
  result.optimized_weight_unit = raw.optimized_weight_unit || raw.weight_unit || "";
  result.optimized_length = String(raw.optimized_length || raw.length || "");
  result.optimized_width = String(raw.optimized_width || raw.width || "");
  result.optimized_height = String(raw.optimized_height || raw.height || "");
  result.optimized_size_unit = raw.optimized_size_unit || raw.size_unit || "";
  
  return result as OptimizedData;
};

const extractJSONObject = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("JSON Extraction failed:", text);
    return null;
  }
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
    if (!rawData) throw new Error("Invalid AI Response during optimization.");
    return normalizeOptimizedData(rawData);
  } catch (error: any) { 
    throw new Error(`Gemini Optimization Failed: ${error.message}`);
  }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Task: Translate this Amazon listing to "${targetLangName}". 
    [STRICT RULES]: 
    1. KEEP ALL JSON KEYS UNCHANGED (optimized_title, optimized_features, optimized_description, search_keywords).
    2. DO NOT translate keys like "optimized_title", only translate the string content.
    3. The "optimized_features" MUST remain an array of strings.
    4. Return exactly the same JSON structure. 
    5. If any content is inappropriate for translation, leave the value as an empty string "".
    
    Data to translate: ${JSON.stringify(sourceData)}
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const rawData = extractJSONObject(response.text || "{}");
    if (!rawData) throw new Error("Empty translation result.");
    return normalizeOptimizedData(rawData);
  } catch (error: any) { 
    throw new Error(`Gemini Translation Failed: ${error.message}`);
  }
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
    throw new Error("No image data returned.");
  } catch (error: any) { throw error; }
};
