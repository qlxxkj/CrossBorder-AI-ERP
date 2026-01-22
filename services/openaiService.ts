
import { CleanedData, OptimizedData } from "../types";

const CORS_PROXY = 'https://corsproxy.io/?';

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    You are an expert Amazon Listing Optimizer. Extract and optimize product data from:
    ${JSON.stringify(cleanedData)}

    [STRICT REQUIREMENTS]
    1. optimized_title: SEO-rich (max 200 chars).
    2. optimized_features: EXACTLY 5 non-empty strings in an array.
    3. optimized_description: 1000-1500 chars HTML.
    4. search_keywords: 250 chars terms.
    5. Logistics: Standardize to Title Case units (Pounds, Inches).

    STRIP ALL BRANDS. Return valid JSON only.
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
  if (data.error) throw new Error(data.error.message || "OpenAI API Error");
  
  const result = JSON.parse(data.choices[0].message.content) as OptimizedData;
  if (result.optimized_features && result.optimized_features.length < 5) {
    while (result.optimized_features.length < 5) result.optimized_features.push("");
  }
  return result;
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  const prompt = `
    Translate and localize for Amazon "${targetLang}". 
    Must maintain 5 bullet points. Localize units.
    Source: ${JSON.stringify(sourceData)}
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
  return JSON.parse(data.choices[0].message.content);
};
