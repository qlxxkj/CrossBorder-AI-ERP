import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    You are an expert Amazon Listing Optimizer. Optimize this:
    ${JSON.stringify(cleanedData)}

    [STRICT RULES]
    1. Title: Max 200 chars.
    2. Bullets: Exactly 5 points. EACH UNDER 250 CHARS. MUST start with [KEYWORD].
    3. Description: HTML format.
    4. NO Brands, NO Extreme words (best, etc), NO Automotive Brands (Toyota, etc).
    
    Return JSON only.
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content) as OptimizedData;
  if (result.optimized_features && result.optimized_features.length < 5) {
    while (result.optimized_features.length < 5) result.optimized_features.push("");
  }
  return result;
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `Translate to "${targetLang}". Keep [KEYWORD] prefix. No brands. Source: ${JSON.stringify(sourceData)}`;
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