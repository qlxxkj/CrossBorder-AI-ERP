
import { CleanedData, OptimizedData } from "../types";

const CORS_PROXY = 'https://corsproxy.io/?';

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) throw new Error("OpenAI API Key is missing.");

  const prompt = `
    Analyze and Optimize this Amazon Listing:
    ${JSON.stringify(cleanedData)}

    [LOGISTICS EXTRACTION]
    - Extract item_weight and dimensions.
    - Standardize to English FULL NAMES: "pounds" and "inches".
    - Numerical precision: 2 decimal places.

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
    
    [CRITICAL - MEASUREMENTS LOCALIZATION]
    1. UNIT CONVERSION:
       - Target Metric Markets (EU, JP, ZH, MX, BR): Convert "pounds" to "kilograms" (x0.45) and "inches" to "centimeters" (x2.54).
       - Target Imperial Markets (US, CA, UK): Keep "pounds" and "inches".
    2. UNIT NAMES: Use FULL NAMES in ${targetLang} (e.g., 'キログラム', 'センチメートル'). NEVER use abbreviations.
    3. NUMERIC VALUES: Exactly 2 decimal places.
    
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
    return JSON.parse(data.choices[0].message.content) as OptimizedData;
  } catch (error: any) { throw error; }
};
