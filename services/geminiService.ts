
import { GoogleGenAI, Type } from "@google/genai";
import { CleanedData, OptimizedData } from "../types";

export const optimizeListingWithAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an expert Amazon Listing Optimizer. Extract and optimize product data from:
    ${JSON.stringify(cleanedData)}

    [STRICT REQUIREMENTS]
    1. Title: Create an SEO-rich title (max 200 chars).
    2. Bullets: Provide EXACTLY 5 high-impact bullet points. Each MUST be a non-empty string. Start each with a [KEYWORD] or emoji.
    3. Description: Write a persuasive product description (1000-1500 chars) using basic HTML.
    4. Search Keywords: Provide 250 characters of high-converting search terms.
    5. Logistics: Standardize weight and size. Units MUST be Title Case (e.g., "Pounds", "Inches").
    
    [CRITICAL] 
    - Strip all specific brand names.
    - If the source data is missing information, use professional common-sense descriptions for this category.
    - Return ONLY valid JSON.
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
            optimized_features: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Exactly 5 bullet points"
            },
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
    const data = JSON.parse(text.trim()) as OptimizedData;
    
    // Ensure features always has 5 elements
    if (data.optimized_features && data.optimized_features.length < 5) {
      while (data.optimized_features.length < 5) data.optimized_features.push("");
    }
    
    return data;
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    throw error;
  }
};

export const translateListingWithAI = async (sourceData: OptimizedData, targetLang: string): Promise<Partial<OptimizedData>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Task: Translate and LOCALIZE the listing into "${targetLang}".
    RULES: 
    - 5 Bullet Points MUST remain 5 points.
    - Translate units to "${targetLang}" local terminology (e.g. "ポンド" for JP).
    - Strip brands.
    
    Source: ${JSON.stringify(sourceData)}
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
          }
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
    throw error;
  }
};

export const editImageWithAI = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      },
    });
    if (!response.candidates?.[0]?.content?.parts) throw new Error("Empty response from AI");
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return part.inlineData.data;
    }
    throw new Error("No image data returned in AI response");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found.")) {
      const aistudio = (window as any).aistudio;
      if (aistudio) aistudio.openSelectKey();
    }
    throw error;
  }
};
