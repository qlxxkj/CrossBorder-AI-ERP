
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://corsproxy.io/?';

const UNIFIED_OPTIMIZE_PROMPT = `
You are an expert Amazon SEO Copywriter. Rewrite this listing for peak conversion.

[STRICT INSTRUCTIONS]
1. NO BRANDS: Delete all brand names and automotive trademarks.
2. REWRITE TITLE: Completely change the word order and structure. Create a compelling, fresh version. MAX 150 characters.
3. 5 DISTINCT BULLETS:
   - Every bullet MUST cover a DIFFERENT aspect (e.g., Build Quality, Smart Tech, Versatility, User Safety, Customer Service).
   - Points MUST NOT be similar or repetitive.
   - FORMAT: Each point MUST start with "UPPERCASE_KEYWORD: " (e.g., RUGGED BUILD: ...).
   - MAX 250 characters each.
4. BACKEND KEYWORDS: STRICTLY MAX 200 characters total.
5. DESCRIPTION: 1000-1700 characters HTML.

Output ONLY a flat JSON object.
`;

const normalizeOptimizedData = (raw: any): OptimizedData => {
  const result: any = {};
  result.optimized_title = String(raw.optimized_title || "").slice(0, 150);
  result.optimized_description = String(raw.optimized_description || "").slice(0, 1700);
  
  // Rule: Search Keywords < 200 (Strict enforcement)
  result.search_keywords = String(raw.search_keywords || "").slice(0, 200);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : [];
  result.optimized_features = feats
    .map((f: any) => String(f || "").trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 5)
    .map((f: any) => {
      let s = String(f).slice(0, 250);
      // Force "KEYWORD:" format if GPT fails
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
  
  const sourceCopy = { ...cleanedData };
  delete sourceCopy.brand;

  const response = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: "Amazon SEO Master. Rewrite titles completely. 5 UNIQUE bullets starting with 'KEYWORD:'. Keywords limit 200. JSON only." },
        { role: "user", content: UNIFIED_OPTIMIZE_PROMPT + `\n\n[SOURCE DATA]\n${JSON.stringify(sourceCopy)}` }
      ],
      temperature: 1.0, // Forced high temperature for variation
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
