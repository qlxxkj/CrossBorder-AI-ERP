
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';
const FALLBACK_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://thingproxy.freeboard.io/fetch/',
  'https://api.codetabs.com/v1/proxy?quest='
];

const UNIFIED_OPTIMIZE_PROMPT = (brand: string, infringementWords: string[], seed: number) => `
Act as a Senior Amazon Listing Expert. Optimize this listing.
[SEED: ${seed}]

[CRITICAL: ZERO TOLERANCE FOR BRANDS]
1. ABSOLUTELY REMOVE THE BRAND: "${brand}" and all its variations (e.g., "${brand.toUpperCase()}", "${brand.toLowerCase()}").
2. ABSOLUTELY REMOVE ALL AUTOMOTIVE BRANDS: Do NOT mention "Mazda", "Toyota", "Honda", "Tesla", "Ford", "BMW", "Mercedes", etc. even if they are in the source data.
3. ABSOLUTELY REMOVE THESE INFRINGEMENT WORDS: ${infringementWords.length > 0 ? infringementWords.join(', ') : 'None provided.'}
4. DO NOT use these words in the Title, Bullets, or Description.
5. YOU MAY retain: Specific model names (e.g., "CX-5", "Corolla"), model years, and OEM/Part numbers.

[CONTENT SPECIFICATIONS]
1. UNIQUE TITLE: Completely rephrase. Use high-converting synonyms. MAX 150 characters.
2. 5 DISTINCT BULLETS: 
- 5 unique points as a plain string array. 
- Format: "KEYWORD: Description".
- Points must cover: [Material], [Design], [Usage], [Compatibility], [Guarantee].
- MAX 300 characters each.
3. SEARCH KEYWORDS: Mandatory field. Highly relevant. STRICTLY MAX 200 characters. NO BRANDS.
4. DESCRIPTION: 1200-1700 chars HTML.

[OUTPUT FORMAT]
Output ONLY a flat JSON object with keys: "optimized_title", "optimized_features", "optimized_description", "search_keywords".
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  const extractText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text || val.content || val.value || JSON.stringify(val);
    return "";
  };

  result.optimized_title = extractText(raw.optimized_title || raw.title || "").slice(0, 150);
  result.optimized_description = extractText(raw.optimized_description || raw.description || "").slice(0, 1700);
  result.search_keywords = extractText(raw.search_keywords || raw.keywords || "").slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : 
              Array.isArray(raw.features) ? raw.features : [];

  result.optimized_features = feats
    .map((f: any) => extractText(f).trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: any) => String(f).slice(0, 300));
    
  while (result.optimized_features.length < 5) {
    result.optimized_features.push("DURABLE CONSTRUCTION: Crafted from heavy-duty materials for exceptional longevity.");
  }
  
  result.optimized_weight_value = extractText(raw.optimized_weight_value || "");
  result.optimized_weight_unit = extractText(raw.optimized_weight_unit || "");
  result.optimized_length = extractText(raw.optimized_length || "");
  result.optimized_width = extractText(raw.optimized_width || "");
  result.optimized_height = extractText(raw.optimized_height || "");
  result.optimized_size_unit = extractText(raw.optimized_size_unit || "");

  // Image handling
  result.optimized_main_image = raw.optimized_main_image || raw.main_image || "";
  result.optimized_other_images = Array.isArray(raw.optimized_other_images) ? raw.optimized_other_images : (Array.isArray(raw.other_images) ? raw.other_images : []);
  
  return result as OptimizedData;
};

export const optimizeListingWithQwen = async (cleanedData: CleanedData, infringementWords: string[] = []): Promise<{ data: OptimizedData; tokens: number }> => {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("Qwen Key missing on server.");
  const baseUrl = (process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  
  const brandToKill = cleanedData.brand || "ORIGINAL_BRAND";
  const sourceCopy = { ...cleanedData };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: process.env.QWEN_MODEL || "qwen-max",
        messages: [
          { role: "system", content: "Amazon SEO Master. Unique Titles. Remove all brands. Search Keywords max 200. JSON only." },
          { role: "user", content: UNIFIED_OPTIMIZE_PROMPT(brandToKill, infringementWords, Date.now()) + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}` }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen API Error (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Qwen returned an empty response.");
    
    const raw = JSON.parse(content);
    const tokens = data.usage?.total_tokens || 0;
    return { data: normalizeOptimizedData(raw), tokens };
  } catch (err: any) {
    console.error("Qwen Server Error:", err);
    throw err;
  }
};

export const translateListingWithQwen = async (sourceData: OptimizedData, targetLangName: string): Promise<{ data: Partial<OptimizedData>; tokens: number }> => {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("Qwen Key missing on server.");
  const baseUrl = (process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.QWEN_MODEL || "qwen-max",
        messages: [
          { role: "system", content: "Professional Amazon translator. JSON only." },
          { role: "user", content: `Translate to "${targetLangName}". JSON keys: optimized_title, optimized_features, optimized_description, search_keywords. NO brands. Data: ${JSON.stringify(sourceData)}` }
        ],
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) throw new Error(`Qwen Translation Error: ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
    const tokens = data.usage?.total_tokens || 0;
    return { data: normalizeOptimizedData(raw), tokens };
  } catch (err: any) {
    console.error("Qwen Translation Server Error:", err);
    throw err;
  }
};
