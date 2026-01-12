
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
    - DO NOT include any trademarked names.
    
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
    Task: Translate and LOCALIZE this Amazon listing into "${targetLang}".
    
    [CRITICAL - MATHEMATICAL UNIT CONVERSION]
    The Source Data is in IMPERIAL units (pounds/inches). You MUST calculate METRIC values precisely.
    
    1. CONSTANTS:
       - 1 pound = 0.45359237 kilograms
       - 1 inch = 2.54 centimeters

    2. CALCULATION RULES (FOR METRIC MARKETS like JP, DE, FR, ES, IT, MX, BR, CN):
       - weight_value = ${sourceData.optimized_weight_value} * 0.453592
       - length/width/height = (source_value) * 2.54
       - RESULT: Round to exactly 2 decimal places. 
       - DO NOT ESTIMATE. Use math.

    3. UNIT FULL NAMES (MANDATORY LOCALIZATION):
       - German: "Kilogramm", "Zentimeter"
       - Japanese: "キログラム", "センチメートル"
       - French: "Kilogrammes", "Centimètres"
       - Spanish: "Kilogramos", "Centímetros"
       - Chinese: "千克", "厘米"
       - English (UK/CA): "Kilograms", "Centimetres" (Note: UK/CA use Metric for Amazon logistics)

    4. BRAND REMOVAL:
       - Ensure NO brands (own brand or automotive brands like Toyota, Lexus) exist in output. Use generic localized descriptors.

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
          required: [
            "optimized_title", "optimized_features", "optimized_description", 
            "optimized_weight_value", "optimized_weight_unit", 
            "optimized_length", "optimized_width", "optimized_height", "optimized_size_unit"
          ]
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
  } catch (error) {
    console.error("AI Image Editing failed:", error);
    throw error;
  }
};
