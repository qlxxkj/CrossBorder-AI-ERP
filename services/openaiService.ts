
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
    
    [CRITICAL - MEASUREMENTS CONVERSION]
    1. MATHEMATICAL CONVERSION:
       - If converting from Imperial (lb/in) to Metric (kg/cm) (Markets like EU, JP, ZH): 
         Multiply weight by 0.45, multiply inches by 2.54.
       - If target is North America/UK: Stay with Imperial.
    2. UNIT NAMES: Use FULL NAMES in ${targetLang} (e.g., 'キログラム', 'センチメートル'). 
       NEVER use abbreviations like 'kg' or 'cm'.
    3. NUMERIC VALUES: Must be rounded to 2 decimal places.
    4. TEXT: Maintain high-converting tone.
    
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
