
import { CleanedData, OptimizedData } from "../types";
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

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
    if (val && typeof val === 'object') return val.text || val.content || val.value || val.string || JSON.stringify(val);
    return "";
  };

  // Robust mapping with multiple aliases
  result.optimized_title = extractText(raw.optimized_title || raw.title || raw.product_title || raw.name || "").slice(0, 200);
  result.optimized_description = extractText(raw.optimized_description || raw.description || raw.product_description || "").slice(0, 2500);
  result.search_keywords = extractText(raw.search_keywords || raw.keywords || raw.tags || "").slice(0, 500);
  
  let feats = Array.isArray(raw.optimized_features) ? raw.optimized_features : 
              Array.isArray(raw.features) ? raw.features : 
              Array.isArray(raw.bullet_points) ? raw.bullet_points : [];

  result.optimized_features = feats
    .map((f: any) => extractText(f).trim())
    .filter((f: string) => f.length > 0)
    .slice(0, 10) // Allow more during processing, but will trim to 5 in UI if needed
    .map((f: any) => String(f).slice(0, 500));
    
  // Minimum 5 features requirement
  if (result.optimized_features.length < 5 && result.optimized_title !== "") {
    const fallbacks = [
      "PREMIUM QUALITY: Engineered for durability and long-lasting performance.",
      "USER-CENTRIC DESIGN: Optimized for ease of use and maximum efficiency.",
      "HEAVY-DUTY MATERIALS: Constructed from high-grade components.",
      "WIDE COMPATIBILITY: Designed to fit multiple models and applications.",
      "CUSTOMER SATISFACTION: Our commitment to quality ensures a great experience."
    ];
    while(result.optimized_features.length < 5) {
      result.optimized_features.push(fallbacks[result.optimized_features.length]);
    }
  }
  
  result.optimized_weight_value = extractText(raw.optimized_weight_value || raw.weight || "");
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

export const optimizeListingWithOpenAI = async (cleanedData: CleanedData, infringementWords: string[] = []): Promise<{ data: OptimizedData; tokens: number }> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI Key missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  
  // Use CORS proxy if on client
  const finalUrl = typeof window !== 'undefined' ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;
  console.log(`🚀 [OpenAI] Fetching via proxy: ${finalUrl}`);
  
  try {
    const response = await fetch(finalUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "Amazon SEO expert. JSON only." },
          { role: "user", content: UNIFIED_OPTIMIZE_PROMPT(cleanedData.brand || "BRAND", infringementWords, Date.now()) + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}` }
        ],
        temperature: 0.8,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ [OpenAI] Error ${response.status}:`, errText);
      throw new Error(`OpenAI API Error (${response.status}): ${errText.slice(0, 100)}`);
    }
    
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ? JSON.parse(data.choices[0].message.content) : {};
    const tokens = data.usage?.total_tokens || 0;
    return { data: normalizeOptimizedData(raw), tokens };
  } catch (err: any) {
    console.error("OpenAI Server Error:", err);
    throw err;
  }
};

export const translateListingWithOpenAI = async (sourceData: OptimizedData, targetLangName: string): Promise<{ data: Partial<OptimizedData>; tokens: number }> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI Key missing.");
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const endpoint = `${baseUrl}/chat/completions`;
  
  // Use CORS proxy if on client
  const finalUrl = typeof window !== 'undefined' ? `${CORS_PROXY}${encodeURIComponent(endpoint)}` : endpoint;
  
  // High-intensity prompt to force field retention even for similar languages
  const prompt = `Translate the following Amazon product listing into "${targetLangName}". 

STRICT RULES:
1. MANDATORY KEYS: "optimized_title", "optimized_features", "optimized_description", "search_keywords".
2. NO DATA LOSS: You MUST return all 4 fields. 
3. ENGLISH VARIANTS: If target language is English (AU, SG, UK), DO NOT skip fields. Repeat the input if no translation is needed, but NEVER return null or empty strings.
4. FORMAT: Return a valid JSON object. "optimized_features" must be an array of strings.
5. ZERO TOLERANCE FOR BRANDS: ABSOLUTELY REMOVE ALL BRAND NAMES (e.g., Mazda, Toyota, etc.) from the translated output.

INPUT DATA:
${JSON.stringify(sourceData)}`;

  try {
    const response = await fetch(finalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "Professional Amazon translator. JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) throw new Error(`OpenAI Translation Error: ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    const tokens = data.usage?.total_tokens || 0;
    return { data: normalizeOptimizedData(JSON.parse(content)), tokens };
  } catch (err: any) {
    console.error("OpenAI Translation Server Error:", err);
    throw err;
  }
};
