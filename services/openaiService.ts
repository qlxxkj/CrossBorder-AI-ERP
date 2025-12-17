import { CleanedData, OptimizedData } from "../types";

/**
 * OpenAI Service for Listing Optimization
 * Note: This requires process.env.OPENAI_API_KEY to be set.
 */
export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  
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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a professional e-commerce copywriter. Output only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI request failed");
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content) as OptimizedData;
  } catch (error) {
    console.error("OpenAI Optimization failed:", error);
    throw error;
  }
};
