
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

/**
 * Optimizes an Amazon listing using Gemini 3 Flash model.
 * Follows strict branding and formatting rules.
 */
export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  // Always create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key.
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
       - Standardize to English Title Case FULL NAMES: "Pounds", "Kilograms", "Inches", "Centimeters". 
       - NEVER use all caps like "KILOGRAMS".
       - Format numbers to 2 decimal places.

    [CRITICAL - BRAND REMOVAL RULE]
    - STRICT: Remove ALL specific brand names (e.g. Bosch, Toyota) from the output.
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

    // The text property returns the generated string directly.
    const text = response.text || "{}";
    return JSON.parse(text.trim()) as OptimizedData;
  } catch (error: any) {
    // If the request fails with "Requested entity was not found.", prompt the user to select a key again.
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    throw error;
  }
};

/**
 * Translates and localizes an Amazon listing using Gemini 3 Flash model.
 */
export const translateListingWithAI = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  // Always create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Task: Translate and LOCALIZE the content for Amazon listing into "${targetLang}".
    
    [STRICT RULES]
    1. Translate Title, 5 Bullets, Description, and Keywords.
    2. LOCALIZE UNIT NAMES: You MUST translate units into the native official terminology of "${targetLang}". 
       - For JP (Japan): Use "ポンド" (Pounds), "キログラム" (Kilograms), "インチ" (Inches), "センチメートル" (Centimeters).
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
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords", "optimized_weight_unit", "optimized_size_unit"]
        }
      }
    });

    // Directly access text property as per guidelines
    const text = response.text || "{}";
    return JSON.parse(text.trim());
  } catch (error: any) {
    // If the request fails with "Requested entity was not found.", prompt the user to select a key again.
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    throw error;
  }
};

/**
 * Edits an image using the gemini-2.5-flash-image model.
 * This function handles sending both image and text parts to the model.
 */
export const editImageWithAI = async (base64Image: string, prompt: string): Promise<string> => {
  // Always create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    };
    const textPart = {
      text: prompt
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [imagePart, textPart] },
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("Empty response from AI");
    }

    // Find and return the image part from the response candidates.
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    throw new Error("No image data returned in AI response");
  } catch (error: any) {
    // Handle API key selection reset for "Requested entity was not found." error.
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    throw error;
  }
};
