
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = (Brand: string) => `
Expert Amazon SEO Copywriter. Optimize this listing.

[CRITICAL BRAND REMOVAL]
1. DELETE BRAND: Completely remove "${Brand}" and all its variants (e.g., "${Brand.toUpperCase()}", "${Brand.toLowerCase()}") from all fields.
2. DELETE TRADEMARKS: No automotive brand names (Toyota, BMW, Tesla, Ford, etc.) or generic manufacturer marks.
3. NO AD WORDS: No "Best", "Top-rated", "Sale".

[CONTENT STRUCTURE]
1. RADICAL TITLE REWRITE: Do NOT reuse the source title's word order. Use a COMPLETELY FRESH structure. Create a compelling, high-CTR version. MAX 150 characters.
2. 5 UNIQUE BULLET POINTS: 
   - Generate exactly 5 points.
   - Each MUST cover a different dimension: [Material/Quality], [Core Design], [Key Benefit], [Usage/Compatibility], [Service/Guarantee].
   - Points MUST be distinct. Each must start with a bold "KEYWORD: " in all caps.
   - MAX 300 characters per point.
3. DESCRIPTION: Professional HTML. 1200-1700 characters.
4. SEARCH KEYWORDS: Highly relevant terms. STRICTLY MAX 200 characters total.


Output ONLY a flat JSON object. Use strings only for feature array elements.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  
  // Safe extractor to handle potential nested objects from AI
  const extractText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text || val.content || val.value || JSON.stringify(val);
    return String(val || "");
  };

  result.optimized_title = extractText(raw.optimized_title).slice(0, 150);
  result.optimized_description = extractText(raw.optimized_description).slice(0, 1700);
  result.search_keywords = extractText(raw.search_keywords || raw.optimized_search_keywords || raw.keywords).slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats
    .map((f: any) => extractText(f).trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: any) => {
      let s = String(f).slice(0, 300);
      if (!s.includes(":") || s.indexOf(":") > 40) {
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
  
  result.optimized_weight_value = extractText(raw.optimized_weight_value);
  result.optimized_weight_unit = extractText(raw.optimized_weight_unit);
  result.optimized_length = extractText(raw.optimized_length);
  result.optimized_width = extractText(raw.optimized_width);
  result.optimized_height = extractText(raw.optimized_height);
  result.optimized_size_unit = extractText(raw.optimized_size_unit);
  
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
        { role: "system", content: "Expert Amazon SEO. Return FLAT JSON. Every feature MUST be a plain string. No nested objects in features array. Keywords limit 200." },
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
  const prompt = `Translate to "${targetLangName}". UNIQUE Title<150, 5 DISTINCT Bullets<300 (KEYWORD: format), Keywords < 200. FLAT JSON. Data: ${JSON.stringify(sourceData)}`;
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
