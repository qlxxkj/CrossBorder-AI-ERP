
import { CleanedData, OptimizedData } from "../types";

const CORS_PROXY = 'https://corsproxy.io/?';

export const optimizeListingWithDeepSeek = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  
  if (!apiKey) throw new Error("DeepSeek API Key is missing.");

  const prompt = `
    You are an expert Amazon Listing Optimizer. Extract and optimize product data from:
    ${JSON.stringify(cleanedData)}

    [CORE TASKS]
    1. Title: Max 200 chars, SEO high-conversion.
    2. Bullets: Exactly 5 high-impact points. Start each with [KEYWORD].
    3. Description: 1000-1500 chars, use HTML (<p>, <br>).
    4. Logistics: 
       - Extract weight and dimensions. 
       - Standardize to English Title Case FULL NAMES: "Pounds", "Kilograms", "Inches", "Centimeters". 
       - NEVER use all caps like "KILOGRAMS".
       - Format numbers to 2 decimal places.

    [CRITICAL - BRAND REMOVAL RULE]
    - STRICT: Remove ALL specific brand names (e.g. Bosch, Toyota, Lexus) from the output.
    - REPLACE brands with generic terms like "select vehicles", "specified models", or "compatible vehicle series".
    
    Return valid JSON.
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("deepseek.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

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

export const translateListingWithDeepSeek = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  
  if (!apiKey) throw new Error("DeepSeek API Key is missing.");

  const prompt = `
    Task: Translate and LOCALIZE the content for Amazon listing into "${targetLang}".
    
    [STRICT RULES]
    1. Translate Title, 5 Bullets, Description, and Keywords.
    2. LOCALIZE UNIT NAMES: You MUST translate units into the native official terminology of "${targetLang}". 
       - For JP (Japan): Use "キログラム" (Kilograms), "ポンド" (Pounds), "センチメートル" (Centimeters), "インチ" (Inches).
       - For Latin languages (DE, FR, IT, ES): Use Title Case like "Kilogramm", "Gramm", "Zentimeter".
       - NEVER leave units in all caps or raw English if target is not US/UK.
    3. BRAND REMOVAL: Strip specific brands and use generic terms in "${targetLang}".
    4. Numeric values must remain untouched.

    Source: ${JSON.stringify({
      title: sourceData.optimized_title,
      features: sourceData.optimized_features,
      description: sourceData.optimized_description,
      keywords: sourceData.search_keywords,
      weight_unit: sourceData.optimized_weight_unit,
      size_unit: sourceData.optimized_size_unit
    })}
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("deepseek.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

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
    return JSON.parse(data.choices[0].message.content);
  } catch (error: any) { throw error; }
};
