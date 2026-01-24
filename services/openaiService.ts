
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = `
You are a professional Amazon SEO Expert. Optimize for conversion.

[STRICT CONSTRAINTS]
1. NO BRAND NAMES: Remove original brand and NO car/motorcycle brands.
2. TITLE: Max 150 characters.
3. BULLETS: 5 points. Start each with a KEYWORD. Max 250 characters each.
4. DESCRIPTION: 1000 - 1700 characters. Use basic HTML.
5. SEARCH KEYWORDS: Max 300 characters.
6. NO ads or extreme words.
7. Use FULL unit names.

Return ONLY a flat JSON object.
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
    .map((f: any) => String(f).slice(0, 250));
    
  while(result.optimized_features.length < 5) {
    result.optimized_features.push("Superior design and material quality for reliable everyday use.");
  }
  
  result.optimized_weight_value = String(raw.optimized_weight_value || "");
  result.optimized_weight_unit = String(raw.optimized_weight_unit || "");
  result.optimized_length = String(raw.optimized_length || "");
  result.optimized_width = String(raw.optimized_width || "");
  result.optimized_height = String(raw.optimized_height || "");
  result.optimized_size_unit = String(raw.optimized_size_unit || "");
  
  return result as OptimizedData;
};

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key is missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;
  
  const sourceCopy = { ...cleanedData };
  delete sourceCopy.brand;

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "Amazon SEO. Output strict flat JSON. No brands. Title<150, Bullets<250x5, Keywords<300." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
  return normalizeOptimizedData(raw);
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key is missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `Translate to "${targetLangName}". Title<150, 5 Bullets<250. Keywords<300. No brands. Data: ${JSON.stringify(sourceData)}`;
  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
  return normalizeOptimizedData(raw);
};
