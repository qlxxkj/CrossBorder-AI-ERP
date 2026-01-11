
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
  } catch (error) {
    console.error("AI Optimization failed:", error);
    throw error;
  }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLang: string): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Translate and LOCALIZE this Amazon listing into the language of "${targetLang}".
    
    [CRITICAL - LOCALIZATION RULES]
    1. CONTENT: Translate Title, 5 Bullet Points, and Description naturally.
    2. UNIT SYSTEM: 
       - If ${targetLang} is for Metric markets (JP, DE, FR, IT, ES, MX, BR, CN): 
         YOU MUST MATHEMATICALLY CONVERT: "pounds" to "kilograms" (multiply by 0.45) and "inches" to "centimeters" (multiply by 2.54).
       - If ${targetLang} is for Imperial markets (US, CA, UK): Keep "pounds" and "inches".
    3. UNIT NAMES: Use FULL NAMES in ${targetLang}. NEVER use abbreviations like 'kg', 'lb', 'cm', 'in'.
       - Japanese: "キログラム", "センチメートル"
       - Chinese: "千克", "厘米"
    4. PRECISION: Rounded to 2 decimal places.

    Source Content: ${JSON.stringify(sourceData)}
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
          required: ["optimized_title", "optimized_features", "optimized_description"]
        }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Gemini translation returned no content.");
    }

    const text = response.text || "{}";
    return JSON.parse(text.trim()) as OptimizedData;
  } catch (error) {
    console.error(`Translation failed:`, error);
    throw error;
  }
};

// Fix: Add editImageWithAI to handle image editing using gemini-2.5-flash-image
/**
 * Edits an image using Gemini AI (gemini-2.5-flash-image).
 * @param base64ImageData - Base64 encoded image data (without data URL prefix).
 * @param prompt - Text instructions for editing.
 * @returns Base64 encoded string of the edited image.
 */
export const editImageWithAI = async (base64ImageData: string, prompt: string): Promise<string> => {
  // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
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

    // Iterate through candidates and parts to find the image part as per guidelines.
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
    
    throw new Error("No image data returned from Gemini in response parts.");
  } catch (error) {
    console.error("AI Image Editing failed:", error);
    throw error;
  }
};
