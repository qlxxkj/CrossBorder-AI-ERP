
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = `
Optimize Amazon Listing. 
1. TITLE < 200 chars.
2. 5 BULLETS < 250 chars each, starting with Keyword.
3. DESCRIPTION 1000 - 1700 chars.
4. NO brands, ads, extreme words, or car/moto brands.
Return ONLY flat JSON.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = String(raw.optimized_title || "").slice(0, 200);
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  result.search_keywords = String(raw.search_keywords || "").slice(0, 250);
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats.slice(0, 5).map((f: any) => String(f).slice(0, 250));
  while (result.optimized_features.length < 5) result.optimized_features.push("");
  
  result.optimized_weight_value = String(raw.optimized_weight_value || "");
  result.optimized_weight_unit = String(raw.optimized_weight_unit || "");
  result.optimized_length = String(raw.optimized_length || "");
  result.optimized_width = String(raw.optimized_width || "");
  result.optimized_height = String(raw.optimized_height || "");
  result.optimized_size_unit = String(raw.optimized_size_unit || "");
  
  return result as OptimizedData;
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
        { role: "system", content: "Amazon copywriter. JSON only. No brands." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) throw new Error(`DeepSeek Error: ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
  return normalizeOptimizedData(raw);
};

export const translateListingWithDeepSeek = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek API Key missing.");
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const prompt = `Translate to "${targetLangName}". Title<200, Bullets<250. Data: ${JSON.stringify(sourceData)}`;
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
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
  return normalizeOptimizedData(raw);
};
