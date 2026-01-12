
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
    - YOU MUST REMOVE ALL SPECIFIC BRAND NAMES.
    - REMOVE ALL AUTOMOTIVE BRAND NAMES AND MODELS (e.g., Lexus, Toyota, Camry, Ford, BMW, etc.).
    - Replace them with generic terms: "Compatible with select vehicles", "Custom fit for specified models".
    - Ensure the listing is brand-neutral.

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
    Task: Translate and LOCALIZE this Amazon listing into "${targetLang}".
    
    [CRITICAL - PHYSICAL CONVERSION]
    Calculate Metric values from the provided US Imperial data using these exact factors:
    - Weight: 1 lb = 0.45359 kg
    - Size: 1 inch = 2.54 cm
    
    Rules:
    1. STRICT MATH: Calculate values based on ${sourceData.optimized_weight_value} lbs and dimensions ${sourceData.optimized_length}x${sourceData.optimized_width}x${sourceData.optimized_height} inches.
    2. PRECISION: Round all results to 2 decimal places.
    3. FULL UNIT NAMES in "${targetLang}": 
       Example: "Kilogramm" (German), "キログラム" (Japanese), "Kilogrammes" (French). Do not use abbreviations like kg, cm.
    4. NO BRANDS: Strip all brand/car names.

    Return JSON:
    {
      "optimized_title": "...",
      "optimized_features": [...],
      "optimized_description": "...",
      "search_keywords": "...",
      "optimized_weight_value": "converted_value",
      "optimized_weight_unit": "localized_full_unit",
      "optimized_length": "converted_value",
      "optimized_width": "converted_value",
      "optimized_height": "converted_value",
      "optimized_size_unit": "localized_full_unit"
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
