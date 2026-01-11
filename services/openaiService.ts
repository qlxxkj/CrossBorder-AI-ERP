
import { CleanedData, OptimizedData } from "../types";

const CORS_PROXY = 'https://corsproxy.io/?';

/**
 * OpenAI Service for Listing Optimization
 */
export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing in environment variables.");
  }

  const prompt = `
    You are an expert Amazon Listing Optimizer. Generate a JSON response for:
    ${JSON.stringify(cleanedData)}

    [COMPLIANCE & LIMITS]
    1. Title: Under 200 characters.
    2. Bullet Points: Exactly 5, starting with [KEYWORD].
    3. Description: 1000-1500 chars, use HTML (<p>, <br>).
    4. Measurements: 
       - Units MUST be full names in English (e.g., "pounds" instead of "lb", "inches" instead of "in").
       - Numeric values (Weight/Size) MUST NOT exceed 2 decimal places.
    5. Prohibited: No brands, no extreme adjectives.

    Return JSON structure:
    {
      "optimized_title": "string",
      "optimized_features": ["string", "string", "string", "string", "string"],
      "optimized_description": "string",
      "search_keywords": "string",
      "optimized_weight_value": "string",
      "optimized_weight_unit": "string",
      "optimized_length": "string",
      "optimized_width": "string",
      "optimized_height": "string",
      "optimized_size_unit": "string"
    }
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") 
    ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` 
    : endpoint;

  try {
    const response = await fetch(finalUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a professional e-commerce copywriter. Output only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${errBody || response.statusText}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response.");
    
    return JSON.parse(content) as OptimizedData;
  } catch (error: any) {
    console.error("OpenAI Optimization failed:", error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Network Error: Failed to reach OpenAI. This is likely a CORS issue or connection block. Please use a custom OPENAI_BASE_URL (proxy).");
    }
    throw error;
  }
};

/**
 * OpenAI Service for Listing Translation & Localization
 */
export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLang: string): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    Translate the following Amazon listing content into the language of "${targetLang}".
    
    [CRITICAL - LOCALIZATION RULES]
    1. MEASUREMENTS CONVERSION: 
       - Convert all numerical values for Weight and Dimensions based on common marketplace standards for ${targetLang}. 
       - If converting from US (Imperial) to Europe/Asia (Metric): 1 pound -> 0.45 kg, 1 inch -> 2.54 cm.
    2. UNIT NAMES: Use FULL NAMES in ${targetLang}. DO NOT USE abbreviations like 'kg', 'lb', 'cm', 'in'.
       - Example (JA): 'キログラム' (kilogram), 'センチメートル' (centimeter).
       - Example (ZH): '千克' (kilogram), '厘米' (centimeter).
    3. NUMERIC VALUES: Must be rounded to 2 decimal places.
    4. TEXT: Maintain high-converting marketing tone in the target language.
    
    Maintain JSON keys. Output valid JSON only.
    Source:
    ${JSON.stringify(sourceData)}
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") 
    ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` 
    : endpoint;

  try {
    const response = await fetch(finalUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a specialized localization expert for Amazon. Output only JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI Translation Error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty translation response.");

    return JSON.parse(content) as OptimizedData;
  } catch (error: any) {
    console.error(`OpenAI Translation to ${targetLang} failed:`, error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error(`Network Error during ${targetLang} translation. Ensure your API Base URL supports browser CORS.`);
    }
    throw error;
  }
};
