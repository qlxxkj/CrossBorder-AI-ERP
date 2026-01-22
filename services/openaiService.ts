import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    You are an expert Amazon Listing Optimizer. Optimize this product for maximum SEO and conversion.
    Source Data: ${JSON.stringify(cleanedData)}

    [STRICT RULES]
    1. Title: Max 200 chars. SEO-rich. No brands.
    2. Bullet Points: Exactly 5. Each MUST start with "[KEYWORD]: " prefix.
    3. Description: 1000-1500 chars HTML (<p>, <br>).
    4. Logistics: Extract optimized_weight_value (number), optimized_weight_unit (full name e.g. "Pounds"), optimized_length, optimized_width, optimized_height (numbers), optimized_size_unit (full name e.g. "Inches").
    5. Prohibited: No Brand names, no "Best/Perfect".

    Return ONLY JSON matching the schema of OptimizedData.
  `;

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
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
  const result = JSON.parse(data.choices[0].message.content);
  
  if (result.optimized_features && result.optimized_features.length < 5) {
    while (result.optimized_features.length < 5) result.optimized_features.push("");
  }
  return result;
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `Translate this Amazon listing to "${targetLangName}". Keep HTML tags and "[KEYWORD]: " style: ${JSON.stringify(sourceData)}`;
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
  return JSON.parse(data.choices[0].message.content);
};