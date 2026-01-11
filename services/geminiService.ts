
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert Amazon Listing Optimizer. Your goal is to maximize SEO and conversion.

    [STRICT CONSTRAINTS]
    1. Title: Max 200 characters.
    2. Bullet Points: Exactly 5 points. Each point MUST start with a "[KEYWORD]: " prefix.
    3. Description: 1000-1500 characters. Use HTML tags like <p> and <br>.
    4. Measurements: Standardize weight and dimensions. 
       - Units MUST be full names in English (e.g., "pounds" instead of "lb", "inches" instead of "in").
       - Numeric values MUST NOT exceed 2 decimal places.
    5. PROHIBITED: No Brand Names, No Extreme Words.

    Analyze and optimize:
    ${JSON.stringify(cleanedData)}
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
    Translate the following Amazon listing content into the language associated with "${targetLang}". 
    
    [CRITICAL - LOCALIZATION RULES]
    1. TEXT: Translate all marketing text (Title, Features, Description, Keywords) naturally for ${targetLang} speakers.
    2. MEASUREMENTS CONVERSION: 
       - If the target locale uses METRIC (most of Europe, Japan, China, etc.), convert Imperial (lb/in) to Metric (kg/cm).
       - Conversion math: 1 pound ≈ 0.45 kg, 1 inch ≈ 2.54 cm.
    3. UNIT NAMES: Use FULL NAMES in the target language ${targetLang}. NEVER use abbreviations like 'kg', 'lb', 'cm', 'in'.
       - Example (Chinese): Use '千克' instead of 'kg', '厘米' instead of 'cm'.
       - Example (Japanese): Use 'キログラム' instead of 'kg', 'センチメートル' instead of 'cm'.
    4. PRECISION: Numerical values for weight/dimensions MUST be rounded to exactly 2 decimal places.
    
    Maintain Amazon compliance. Output valid JSON only.

    Source Content:
    ${JSON.stringify(sourceData)}
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
          required: ["optimized_title", "optimized_features", "optimized_description", "search_keywords", "optimized_weight_value", "optimized_weight_unit", "optimized_length", "optimized_width", "optimized_height", "optimized_size_unit"]
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text.trim()) as OptimizedData;
  } catch (error) {
    console.error(`Translation to ${targetLang} failed:`, error);
    throw error;
  }
};

export const editImageWithAI = async (imageBase64: string, instruction: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: instruction }
        ]
      }
    });
    
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    throw new Error("No image generated.");
  } catch (error) {
    console.error("AI Image Edit failed:", error);
    throw error;
  }
};
