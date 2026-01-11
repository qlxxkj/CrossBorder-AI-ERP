
import { CleanedData, OptimizedData } from "../types";

/**
 * OpenAI Service for Listing Optimization
 */
export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing.");
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

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a professional e-commerce copywriter. Output only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content) as OptimizedData;
  } catch (error: any) {
    console.error("OpenAI Optimization failed:", error);
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
    Translate the following Amazon listing content into ${targetLang}.
    
    [CRITICAL - MEASUREMENTS LOCALIZATION]
    1. CONVERT values if units change (e.g., Imperial to Metric).
    2. UNITS MUST BE FULL NAMES in ${targetLang}. NEVER USE ABBREVIATIONS.
       - Example (ZH): 'pounds' -> '磅', 'kilograms' -> '千克', 'inches' -> '英寸', 'centimeters' -> '厘米'.
       - Example (JA): 'kilograms' -> 'キログラム', 'centimeters' -> 'センチメートル'.
       - Example (DE): 'kilograms' -> 'Kilogramm', 'centimeters' -> 'Zentimeter'.
    
    Maintain JSON keys.
    Source:
    ${JSON.stringify(sourceData)}
  `;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a specialized localization expert for Amazon. Output only JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content) as OptimizedData;
  } catch (error: any) {
    console.error(`OpenAI Translation to ${targetLang} failed:`, error);
    throw error;
  }
};
