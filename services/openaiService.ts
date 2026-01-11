
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
    Translate and LOCALIZE this Amazon listing into "${targetLang}".
    
    [CRITICAL - UNIT LOCALIZATION]
    The input data is in Imperial units (pounds, inches). 
    
    1. MATH CONVERSION: 
       If the target market uses METRIC (most markets except US/CA/UK):
       - Convert pounds to kilograms (pounds * 0.4536).
       - Convert inches to centimeters (inches * 2.54).
       - Always round to 2 decimal places.
    
    2. UNIT NAMES: Use FULL native language names for units. NEVER use "kg", "lb", "cm", "in". 
       For example, use "Kilogramm" in German, "キログラム" in Japanese.
    
    3. Return JSON with all logistics fields included:
    {
      "optimized_title": "...",
      "optimized_features": [...],
      "optimized_description": "...",
      "search_keywords": "...",
      "optimized_weight_value": "converted_number",
      "optimized_weight_unit": "localized_full_name",
      "optimized_length": "converted_number",
      "optimized_width": "converted_number",
      "optimized_height": "converted_number",
      "optimized_size_unit": "localized_full_name"
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
