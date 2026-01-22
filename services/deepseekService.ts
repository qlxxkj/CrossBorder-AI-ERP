
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = `
You are an expert Amazon Listing Optimizer. Return ONLY flat JSON.
Keys: optimized_title, optimized_features (array), optimized_description, search_keywords, optimized_weight_value, optimized_weight_unit, optimized_length, optimized_width, optimized_height, optimized_size_unit.
[UNIT RULE]: Always use full names for units in Sentence case (e.g., "Kilograms").
PROHIBITED: NO Car Brand Names.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = raw.optimized_title || raw.title || "";
  result.optimized_description = raw.optimized_description || raw.description || raw.desc || "";
  result.search_keywords = raw.search_keywords || raw.keywords || "";
  let feats = raw.optimized_features || raw.features || raw.bullet_points || [];
  if (typeof feats === 'string') feats = feats.split('\n').filter(Boolean);
  if (!Array.isArray(feats)) feats = [];
  const finalFeats = ["", "", "", "", ""];
  feats.slice(0, 5).forEach((f, i) => finalFeats[i] = String(f));
  result.optimized_features = finalFeats;
  
  result.optimized_weight_value = String(raw.optimized_weight_value || raw.weight_value || "");
  const wUnit = String(raw.optimized_weight_unit || raw.weight_unit || "").toLowerCase();
  result.optimized_weight_unit = wUnit ? wUnit.charAt(0).toUpperCase() + wUnit.slice(1) : "";

  result.optimized_length = String(raw.optimized_length || raw.length || "");
  result.optimized_width = String(raw.optimized_width || raw.width || "");
  result.optimized_height = String(raw.optimized_height || raw.height || "");
  
  const sUnit = String(raw.optimized_size_unit || raw.size_unit || "").toLowerCase();
  result.optimized_size_unit = sUnit ? sUnit.charAt(0).toUpperCase() + sUnit.slice(1) : "";
  
  return result as OptimizedData;
};

const extractJSONObject = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    return null;
  }
};

export const optimizeListingWithDeepSeek = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek API Key missing.");

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("deepseek.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: "Amazon copywriter. Output JSON. Use full unit names in Sentence case. No car brands." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  
  if (!response.ok) throw new Error(`DeepSeek API Error: ${response.status}`);
  const data = await response.json();
  const raw = extractJSONObject(data.choices?.[0]?.message?.content || "{}");
  return normalizeOptimizedData(raw || {});
};

export const translateListingWithDeepSeek = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek API Key missing.");

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const prompt = `
    Translate listing to "${targetLangName}". 
    STRICT: Use full unit names in the "${targetLangName}" language.
    Data: ${JSON.stringify(sourceData)}
  `;
  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("deepseek.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  
  if (!response.ok) throw new Error(`DeepSeek Translate API Error: ${response.status}`);
  const data = await response.json();
  const raw = extractJSONObject(data.choices?.[0]?.message?.content || "{}");
  return normalizeOptimizedData(raw || {});
};
