
import { CleanedData, OptimizedData } from "../types";

const CORS_PROXY = 'https://corsproxy.io/?';

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    Analyze and Optimize this Amazon Listing for maximum conversion:
    ${JSON.stringify(cleanedData)}

    [TASKS]
    - Extract Title, Brand, 5 Bullet Points, and Description.
    - Extract item_weight and dimensions. Standardize to FULL NAMES: "pounds", "inches".
    - Accuracy: 2 decimal places.

    [CRITICAL - ANONYMIZATION RULE]
    - YOU MUST REMOVE ALL SPECIFIC BRAND NAMES AND AUTOMOTIVE MODELS (e.g. Toyota, Lexus).
    - Replace with generic terms: "Compatible with select vehicles".

    Return JSON:
    {
      "optimized_title": "...",
      "optimized_features": ["...", "...", "...", "...", "..."],
      "optimized_description": "...",
      "search_keywords": "...",
      "optimized_weight_value": "number",
      "optimized_weight_unit": "pounds",
      "optimized_length": "number",
      "optimized_width": "number",
      "optimized_height": "number",
      "optimized_size_unit": "inches"
    }
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  try {
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
    if (!data.choices || data.choices.length === 0) throw new Error("OpenAI returned empty choices.");

    return JSON.parse(data.choices[0].message.content) as OptimizedData;
  } catch (error: any) { throw error; }
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLang: string): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    Task: Translate and LOCALIZE the TEXT ONLY of this Amazon listing into "${targetLang}".
    
    Rules:
    1. DO NOT calculate or change any weights or dimensions. 
    2. ONLY translate: Title, Bullets, Description, Keywords.
    3. BRAND SAFETY: Remove all specific brands (Toyota, Lexus, etc.) and use generic phrases.
    
    Return JSON:
    {
      "optimized_title": "...",
      "optimized_features": [...],
      "optimized_description": "...",
      "search_keywords": "..."
    }

    Source: ${JSON.stringify(sourceData)}
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  try {
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
    
    if (data.error) throw new Error(data.error.message || "OpenAI Translation Error");
    if (!data.choices || data.choices.length === 0) throw new Error("OpenAI returned no translation content.");

    return JSON.parse(data.choices[0].message.content) as OptimizedData;
  } catch (error: any) { throw error; }
};
