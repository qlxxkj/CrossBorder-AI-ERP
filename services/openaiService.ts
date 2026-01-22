
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

Return ONLY a flat JSON object matching these keys. Do not include markdown formatting or "\`\`\`json" tags.
`;

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
        { role: "system", content: "You are a professional Amazon copywriter who outputs raw JSON." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  
  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) throw new Error("OpenAI returned empty response");
  
  let content = data.choices[0].message.content;
  content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/```/g, '').trim();
  
  try {
    const result = JSON.parse(content);
    if (!result.optimized_features || !Array.isArray(result.optimized_features)) {
      result.optimized_features = [];
    }
    while (result.optimized_features.length < 5) result.optimized_features.push("");
    return result;
  } catch (parseError) {
    throw new Error("AI returned invalid JSON structure.");
  }
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `
    Translate this Amazon listing to "${targetLangName}". 
    [STRICT]: 
    1. Keep HTML tags.
    2. Maintain "[KEYWORD]: " style.
    3. IMPORTANT: Translate measurement units (e.g. Kilograms, Centimeters) into the target language of the marketplace (e.g., 'كيلوجرام' for Arabic, 'Kilogramm' for German).
    Return ONLY flat JSON: ${JSON.stringify(sourceData)}
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
  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || "{}";
  content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').replace(/```/g, '').trim();
  return JSON.parse(content);
};
