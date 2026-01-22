
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = `
You are an expert Amazon Listing Optimizer. Your goal is to maximize SEO and conversion for the US marketplace.

[STRICT CONSTRAINTS]
1. optimized_title: Max 200 characters. SEO-rich, no brand names.
2. optimized_features: Array of exactly 5 strings. Each MUST start with a "[KEYWORD]: " prefix.
3. optimized_description: 1000-1500 characters. Use HTML tags like <p> and <br>.
4. search_keywords: High-volume relevant terms.
5. Measurements (US Standard): 
   - optimized_weight_value: Pure number string.
   - optimized_weight_unit: "Pounds" or "Ounces".
   - optimized_length, optimized_width, optimized_height: Pure number strings.
   - optimized_size_unit: "Inches".
6. PROHIBITED: No Brand Names, No Extreme Words (Best, Perfect, etc.).

Return ONLY a flat JSON object matching these keys.
`;

const extractJSONObject = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("OpenAI JSON Extraction failed. Raw:", text);
    return null;
  }
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
        { role: "system", content: "You are a professional Amazon copywriter who outputs raw JSON. NO markdown." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) throw new Error("OpenAI Quota Exceeded (429).");
    throw new Error(`OpenAI API Error (${response.status}): ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const result = extractJSONObject(content);
  
  if (!result) throw new Error("OpenAI returned invalid or unparsable JSON.");
  
  if (!result.optimized_features || !Array.isArray(result.optimized_features)) result.optimized_features = [];
  while (result.optimized_features.length < 5) result.optimized_features.push("");
  return result as OptimizedData;
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key is missing.");
  
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `
    Task: Translate this Amazon listing to "${targetLangName}". 
    [STRICT RULES]: 
    1. KEEP ALL JSON KEYS UNCHANGED.
    2. Keep HTML tags.
    3. Maintain "[KEYWORD]: " style for bullets.
    4. Translate measurement units (e.g. Kilograms, Centimeters) into the official language of ${targetLangName} market.
    5. Return ONLY a valid JSON object.
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
  const content = data.choices?.[0]?.message?.content || "{}";
  const result = extractJSONObject(content);
  if (!result) throw new Error("OpenAI returned empty or malformed translation JSON.");
  return result;
};
