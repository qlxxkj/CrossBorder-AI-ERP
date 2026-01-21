
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert Amazon Listing Optimizer. Extract and optimize product data from:
    ${JSON.stringify(cleanedData)}

    [CORE TASKS]
    1. Title: Max 200 chars, SEO high-conversion.
    2. Bullets: Exactly 5 high-impact points. Start each with [KEYWORD].
    3. Description: 1000-1500 chars, use HTML (<p>, <br>).
    4. Logistics: 
       - Extract weight and dimensions. 
       - Standardize to English FULL NAMES: "pounds" and "inches".
       - Format numbers to 2 decimal places.

    [CRITICAL - BRAND REMOVAL RULE]
    - STRICT: Remove ALL specific brand names from the output.
    - This includes the product's own brand AND any automotive brands/models (e.g., Toyota, Lexus, Camry, ES350, Honda, Ford, etc.).
    - REPLACE brands with generic terms like "select vehicles", "specified models", or "compatible vehicle series".
    
    Return valid JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimized_title: { type: Type.STRING },
            optimized_features: { type: Type.ARRAY, items: { type: Type.STRING } },
            optimized_description: { type: Type.STRING },
            search_keywords: { type: Type.STRING },
            optimized_weight_value: { type: Type.STRING },
            optimized_weight_unit: { type: Type.STRING },
            optimized_length: { type: Type.STRING },
            optimized_width: { type: Type.STRING },
            optimized_height: { type: Type.STRING },
            optimized_size_unit: { type: Type.STRING }
          },
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords"]
        }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Gemini returned no response candidates.");
    }

    const text = response.text || "{}";
    return JSON.parse(text.trim()) as OptimizedData;
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    console.error("AI Optimization failed:", error);
    throw error;
  }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Task: Translate and LOCALIZE the TEXT content of this Amazon listing into "${targetLang}".
    
    [CORE TRANSLATION]
    1. Translate: Title, 5 Bullets, Description, and Keywords.
    2. Localize unit names: Translate "Pounds", "Kilograms", "Inches", "Centimeters" into their natural equivalents in "${targetLang}" (e.g., for JP use "キログラム", "センチメートル").
    3. DO NOT change the numeric values themselves.
    4. BRAND REMOVAL: Strip all specific brands (e.g., Toyota, Lexus, Bosch, etc.) and replace with generic terms like "compatible vehicles" in "${targetLang}".
    5. QUALITY: Use natural, high-converting language for the "${targetLang}" market.

    Source: ${JSON.stringify({
      title: sourceData.optimized_title,
      features: sourceData.optimized_features,
      description: sourceData.optimized_description,
      keywords: sourceData.search_keywords,
      weight_unit: sourceData.optimized_weight_unit,
      size_unit: sourceData.optimized_size_unit
    })}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimized_title: { type: Type.STRING },
            optimized_features: { type: Type.ARRAY, items: { type: Type.STRING } },
            optimized_description: { type: Type.STRING },
            search_keywords: { type: Type.STRING },
            optimized_weight_unit: { type: Type.STRING },
            optimized_size_unit: { type: Type.STRING }
          },
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.trim());
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    console.error(`Gemini Translation failed:`, error);
    throw error;
  }
};

export const search1688WithAI = async (productTitle: string, imageUrl: string): Promise<any[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Use Google Search to find exactly 4 REAL wholesale product listings on 1688.com that match this item:
    Title: "${productTitle}"
    Image context: ${imageUrl}

    Instructions:
    1. Find exact or very similar items on 1688.com.
    2. Return a JSON array of objects.
    3. Each object MUST have: "title" (product name), "price" (approximate price in CNY), "image" (thumbnail URL), "link" (1688 product URL).
    4. Return ONLY the raw JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              price: { type: Type.STRING },
              image: { type: Type.STRING },
              link: { type: Type.STRING }
            },
            required: ["title", "price", "image", "link"]
          }
        }
      }
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources = chunks.filter((c: any) => c.web?.uri).map((c: any) => c.web.uri);
    if (webSources.length > 0) {
      console.log("Sources identified by Gemini:", webSources);
    }

    const text = response.text || "[]";
    return JSON.parse(text.trim());
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    console.error("AI 1688 Sourcing failed:", error);
    return [];
  }
};

export const editImageWithAI = async (base64ImageData: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: 'image/jpeg',
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Gemini returned no response candidates for image editing.");
    }

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    throw new Error("No image data returned from Gemini in response parts.");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    console.error("AI Image Editing failed:", error);
    throw error;
  }
};
