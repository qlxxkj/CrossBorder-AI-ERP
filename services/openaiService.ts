
import { CleanedData, OptimizedData } from "../types";

/**
 * OpenAI Service for Listing Optimization
 * Dynamically uses configuration from environment variables.
 */
export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing. Please set OPENAI_API_KEY in your environment.");
  }

  const prompt = `
    You are an expert Amazon Listing Optimizer. Generate a JSON response based on the following product data.

    [COMPLIANCE & LIMITS]
    1. Title: Strictly under 200 characters.
    2. Bullet Points: Generate exactly 5 points. Each point must start with a Bolded Keyword (e.g., "[DURABLE MATERIAL]: ..."). Max 500 chars per point.
    3. Description: Length must be between 1000 and 1500 characters. Focus on usage scenarios and technical benefits.
    4. Search Keywords: Max 500 characters total, comma-separated.
    5. DO NOT USE: 
       - Brand Names.
       - Extreme adjectives (Best, No.1, Perfect, Top).
       - Car Brand Names (Lexus, Toyota, Ford, etc.). Use "Universal Fit" or "Compatible with standard models".

    Product Data:
    ${JSON.stringify(cleanedData)}

    Return a JSON object with this structure:
    {
      "optimized_title": "string",
      "optimized_features": ["string", "string", "string", "string", "string"],
      "optimized_description": "string",
      "search_keywords": "string"
    }
  `;

  try {
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
          { role: "system", content: "You are a professional e-commerce copywriter. Output only valid JSON and strictly follow character limits and prohibited word lists." },
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
