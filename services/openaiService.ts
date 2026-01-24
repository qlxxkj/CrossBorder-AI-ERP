
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = (Brand: string) => `
Act as a Senior Amazon SEO Specialist. Your goal is to REWRITE the product data to maximize conversion and search visibility.

[CRITICAL REMOVAL RULES]
1. REMOVE SPECIFIC BRAND: Completely delete the brand name "${Brand}" (and its uppercase/lowercase variants) from all fields.
2. REMOVE TRADEMARKS: Delete ALL automotive/motorcycle brand names (e.g., Toyota, BMW, Tesla, Honda, etc.) and generic trademarked terms.
3. NO AD WORDS: No "Best", "Top-rated", "Sale".

[CONTENT STRUCTURE]
1. RADICAL TITLE REWRITE: Do NOT follow the source title's word order. Use a completely fresh, high-CTR structure with synonyms. Strictly MAX 150 characters.
2. 5 UNIQUE BULLET POINTS: 
   - Generate exactly 5 points.
   - Each point MUST cover a different product dimension: [1. Construction/Material], [2. Core Feature], [3. User Benefit], [4. Compatibility], [5. Care/Guarantee].
   - Points MUST be distinct. Each must start with a bold "KEYWORD: " in all caps.
   - MAX 350 characters per point.
3. DESCRIPTION: Professional HTML. 1200-1700 characters.
4. SEARCH KEYWORDS: Highly relevant terms. STRICTLY MAX 200 characters. DO NOT EXCEED.

[VARIATION]
Even if the source looks optimized, generate a DRATICALLY DIFFERENT version using a new vocabulary.

Output ONLY a flat JSON object including optimized_title, optimized_features, optimized_description, and search_keywords.No Markdown.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = String(raw.optimized_title || "").slice(0, 150);
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  
  // Amazon Limit 200 for Search Keywords
  result.search_keywords = String(raw.search_keywords || "").slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats
    .map((f: any) => String(f || "").trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: any) => {
      let s = String(f).slice(0, 250);
      if (!s.includes(":") || s.indexOf(":") > 30) {
        return "EXCEPTIONAL FEATURE: " + s;
      }
      return s;
    });
    
  while(result.optimized_features.length < 5) {
    const fallbacks = [
      "RELIABLE QUALITY: Precision engineered to ensure high performance and satisfaction.",
      "INNOVATIVE DESIGN: Crafted to blend seamlessly with your lifestyle and needs.",
      "SUPERIOR MATERIALS: Using only heavy-duty components for maximum durability.",
      "ENHANCED SAFETY: Rigorously tested to meet the highest industry standards.",
      "UNMATCHED VALUE: Premium performance delivered at a competitive price point."
    ];
    result.optimized_features.push(fallbacks[result.optimized_features.length]);
  }
  
  result.optimized_weight_value = String(raw.optimized_weight_value || "");
  result.optimized_weight_unit = String(raw.optimized_weight_unit || "");
  result.optimized_length = String(raw.optimized_length || "");
  result.optimized_width = String(raw.optimized_width || "");
  result.optimized_height = String(raw.optimized_height || "");
  result.optimized_size_unit = String(raw.optimized_size_unit || "");
  
  return result as OptimizedData;
};

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData): Promise<OptimizedData> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI Key missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;
  
  const brandToKill = cleanedData.brand || "ORIGINAL_BRAND";
  const sourceCopy = { ...cleanedData };

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "Amazon SEO Master. You must return ALL JSON fields including 'search_keywords'. Max variation on titles. Remove brands." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT(brandToKill) + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}` }
      ],
      temperature: 1.0,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) throw new Error(`OpenAI Status: ${response.status}`);
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
  return normalizeOptimizedData(raw);
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<Partial<OptimizedData>> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI Key missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = `Translate to "${targetLangName}". UNIQUE Title<150, 5 DISTINCT Bullets<250 (KEYWORD: format), Keywords < 200. FLAT JSON. Data: ${JSON.stringify(sourceData)}`;
  const endpoint = `${baseUrl}/chat/completions`;
  const finalUrl = baseUrl.includes("api.openai.com") ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
  return normalizeOptimizedData(raw);
};
