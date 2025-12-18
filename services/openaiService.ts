import { CleanedData, OptimizedData } from "../types";

/**
 * OpenAI Service for Listing Optimization
 * Dynamically uses configuration from environment variables.
 */
export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  // 支持自定义 Base URL 和 Model，提供默认值以保证兼容性
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing. Please set OPENAI_API_KEY in your environment.");
  }

  const prompt = `
    You are an expert Amazon Listing Optimizer. 
    Return a JSON object with the following structure:
    {
      "optimized_title": "string",
      "optimized_features": ["string", "string", "string", "string", "string"],
      "optimized_description": "string",
      "search_keywords": "string"
    }
    
    Product Data:
    ${JSON.stringify(cleanedData)}
  `;

  try {
    // 拼接完整的聊天补全接口地址
    const endpoint = `${baseUrl}/chat/completions`;
    
    const response = await fetch(endpoint, {
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
      const err = await response.json().catch(() => ({ error: { message: `HTTP Error ${response.status}` } }));
      throw new Error(err.error?.message || `OpenAI request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content) as OptimizedData;
  } catch (error: any) {
    console.error("OpenAI Optimization failed:", error);
    throw new Error(error.message || "Failed to optimize listing with OpenAI");
  }
};