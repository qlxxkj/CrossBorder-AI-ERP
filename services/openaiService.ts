import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    Optimize this Amazon product: ${JSON.stringify(cleanedData)}
    Requirements:
    - 5 Bullets, title, description.
    - Extract Logistics: optimized_weight_value (number), optimized_weight_unit (full word), optimized_length, optimized_width, optimized_height (numbers), optimized_size_unit (full word).
    - Return JSON only.
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
  return JSON.parse(data.choices[0].message.content);
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `Translate to "${targetLangName}": ${JSON.stringify(sourceData)}`;
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