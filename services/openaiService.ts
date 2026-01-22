
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = `
You are an expert Amazon Listing Optimizer. Your goal is to maximize conversion.

[STRICT CONSTRAINTS]
1. Keys: optimized_title, optimized_features (array), optimized_description, search_keywords, optimized_weight_value, optimized_weight_unit, optimized_length, optimized_width, optimized_height, optimized_size_unit.
2. [IMPORTANT] Units: Always use full words for units in the TARGET language.
   - For English/Latin: Sentence Case (e.g., "Kilograms").
   - For Japan: "キログラム", "センチメートル".
   - For Arabic: "كيلوجرام".
   - For Mexico/Brazil: "Kilogramos", "Centímetros".
3. PROHIBITED: Strictly NO Car or Motorcycle Brand Names (BMW, Toyota, Honda, Yamaha, Kawasaki, etc.).

Return ONLY flat JSON.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = raw.optimized_title || raw.title || "";
  result.optimized_description = raw.optimized_description || raw.description || raw.desc || "";
  result.search_keywords = raw.search_keywords || raw.keywords || "";
  let feats = raw.optimized_features || raw.features || raw.bullet_points || [];
  if (typeof feats === 'string') feats = feats.split('\n').map(s => s.trim()).filter(Boolean);
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

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key is missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;
  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "Amazon copywriter. Output JSON. Use full unit names. Strictly NO car/motorcycle brands." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
  const data = await response.json();
  const raw = extractJSONObject(data.choices?.[0]?.message?.content || "{}");
  return normalizeOptimizedData(raw || {});
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key is missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `
    Translate Amazon listing to "${targetLangName}". 
    [STRICT]: 
    1. KEEP JSON KEYS UNCHANGED.
    2. RETURN ONLY JSON. 
    3. Use FULL unit names in "${targetLangName}".
    4. NO car/motorcycle brands.
    Data: ${JSON.stringify(sourceData)}
  `;
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
  if (!response.ok) throw new Error(`OpenAI Translate API Error: ${response.status}`);
  const data = await response.json();
  const raw = extractJSONObject(data.choices?.[0]?.message?.content || "{}");
  return normalizeOptimizedData(raw || {});
};
