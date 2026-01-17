
import { CleanedData, OptimizedData } from "../types";

const CORS_PROXY = 'https://corsproxy.io/?';

/**
 * DeepSeek API 服务
 * DeepSeek 接口与 OpenAI 兼容，但需使用其特定的 API KEY 和 Base URL
 */
export const optimizeListingWithDeepSeek = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  
  if (!apiKey) throw new Error("DeepSeek API Key is missing.");

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
  // 如果是官方域名，可能需要通过代理绕过移动端/插件环境的 CORS 限制
  const finalUrl = baseUrl.includes("deepseek.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  try {
    const response = await fetch(finalUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `DeepSeek API Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) throw new Error("DeepSeek returned empty choices.");

    return JSON.parse(data.choices[0].message.content) as OptimizedData;
  } catch (error: any) {
    console.error("DeepSeek Optimization failed:", error);
    throw error;
  }
};

export const translateListingWithDeepSeek = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  
  if (!apiKey) throw new Error("DeepSeek API Key is missing.");

  const prompt = `
    Task: Translate and LOCALIZE the TEXT ONLY of this Amazon listing into "${targetLang}".
    
    Rules:
    1. DO NOT perform any math or return any logistics data (weight, length, width, height).
    2. ONLY translate: Title, Bullets, Description, Keywords.
    3. BRAND SAFETY: Strip all specific brands/car names.
    
    Return JSON:
    {
      "optimized_title": "...",
      "optimized_features": [...],
      "optimized_description": "...",
      "search_keywords": "..."
    }

    Source: ${JSON.stringify({
      title: sourceData.optimized_title,
      features: sourceData.optimized_features,
      description: sourceData.optimized_description,
      keywords: sourceData.search_keywords
    })}
  `;

  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("deepseek.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  try {
    const response = await fetch(finalUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) throw new Error(`DeepSeek Translation Error: ${response.status}`);

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) throw new Error("DeepSeek returned no translation content.");

    return JSON.parse(data.choices[0].message.content);
  } catch (error: any) {
    console.error("DeepSeek Translation failed:", error);
    throw error;
  }
};
