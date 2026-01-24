
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = (brand: string, seed: number) => `
Act as a Senior Amazon Listing Expert. Optimize this listing. 
[SEED: ${seed}]

[STRICT BRAND PURGE]
- REMOVE BRAND: "${brand}" (including variants like "${brand.toUpperCase()}") MUST be deleted.
- REMOVE AUTOMOTIVE: NO car/motorcycle brands (Toyota, Tesla, etc.).
- Retain the vehicle model and OE number.

[CONTENT SPECIFICATIONS]
1. UNIQUE TITLE: Change the word sequence completely.Use high-converting synonyms. Be creative. MAX 150 characters.
2. 5 DISTINCT BULLETS: 5 unique points as a plain string array. Format: "KEYWORD: Description".Points must cover: [Material], [Design], [Usage], [Compatibility], [Guarantee].MAX 300 characters each.
3. SEARCH KEYWORDS: Mandatory field.Highly relevant. STRICTLY MAX 200 characters.
4. DESCRIPTION: 1200-1700 chars HTML.

Output ONLY a flat JSON object with keys: "optimized_title", "optimized_features", "optimized_description", "search_keywords".
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  
  const extractText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text || val.content || val.value || val.string || JSON.stringify(val);
    return "";
  };

  // Aliases for OpenAI consistency
  result.optimized_title = extractText(raw.optimized_title || raw.title || raw.product_title || "").slice(0, 150);
  result.optimized_description = extractText(raw.optimized_description || raw.description || raw.product_description || "").slice(0, 1700);
  result.search_keywords = extractText(raw.search_keywords || raw.keywords || raw.optimized_search_keywords || "").slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : 
              Array.isArray(raw.features) ? raw.features : 
              Array.isArray(raw.bullet_points) ? raw.bullet_points : [];

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
  
  result.optimized_weight_value = extractText(raw.optimized_weight_value || raw.item_weight_value || "");
  result.optimized_weight_unit = extractText(raw.optimized_weight_unit || raw.item_weight_unit || "");
  result.optimized_length = extractText(raw.optimized_length || raw.item_length || "");
  result.optimized_width = extractText(raw.optimized_width || raw.item_width || "");
  result.optimized_height = extractText(raw.optimized_height || raw.item_height || "");
  result.optimized_size_unit = extractText(raw.optimized_size_unit || raw.item_size_unit || "");
  
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
        { role: "system", content: "Expert Amazon SEO. Use EXACT JSON KEYS: optimized_title, optimized_features, optimized_description, search_keywords. Keywords limit 200." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT(brandToKill, Date.now()) + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}` }
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
  const prompt = `Translate to "${targetLangName}". UNIQUE Title<150, 5 DISTINCT Bullets<300, Keywords<200. FLAT JSON. Data: ${JSON.stringify(sourceData)}`;
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
