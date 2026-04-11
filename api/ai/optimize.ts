
import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

const UNIFIED_OPTIMIZE_PROMPT = (brand: string, infringementWords: string[], seed: number) => `
Act as a Senior Amazon Listing Expert. Optimize this listing.
[SEED: ${seed}]

[CRITICAL: ZERO TOLERANCE FOR BRANDS]
1. ABSOLUTELY REMOVE THE BRAND: "${brand}" and all its variations.
2. ABSOLUTELY REMOVE ALL AUTOMOTIVE BRANDS: Mazda, Toyota, Honda, Tesla, Ford, BMW, Mercedes, etc.
3. ABSOLUTELY REMOVE THESE INFRINGEMENT WORDS: ${infringementWords.length > 0 ? infringementWords.join(', ') : 'None provided.'}
4. DO NOT use these words in the Title, Bullets, or Description.
5. YOU MAY retain: Specific model names (e.g., "CX-5"), model years, and OEM/Part numbers.

[CONTENT SPECIFICATIONS]
1. UNIQUE TITLE: Completely rephrase. MAX 150 characters.
2. 5 DISTINCT BULLETS: Format "KEYWORD: Description". MAX 300 characters each.
3. SEARCH KEYWORDS: Mandatory. MAX 200 characters. NO BRANDS.
4. DESCRIPTION: 1200-1700 chars HTML.

Return ONLY a flat JSON object with keys: "optimized_title", "optimized_features", "optimized_description", "search_keywords".
`;

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { engine, cleanedData, infringementWords } = await req.json();
    const brand = cleanedData.brand || "BRAND";

    if (engine === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY missing");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: UNIFIED_OPTIMIZE_PROMPT(brand, infringementWords, Date.now()) + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}`,
        config: { responseMimeType: "application/json", temperature: 1.0 }
      });
      const text = response.text || "";
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
      const tokens = response.usageMetadata?.totalTokenCount || 0;
      return new Response(JSON.stringify({ data: JSON.parse(jsonStr), tokens }), { headers: { 'Content-Type': 'application/json' } });
    }

    // OpenAI, DeepSeek, Qwen logic
    let apiKey, baseUrl, modelName;
    if (engine === 'openai') {
      apiKey = process.env.OPENAI_API_KEY;
      baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
    } else if (engine === 'deepseek') {
      apiKey = process.env.DEEPSEEK_API_KEY;
      baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
      modelName = process.env.DEEPSEEK_MODEL || "deepseek-chat";
    } else if (engine === 'qwen') {
      apiKey = process.env.QWEN_API_KEY;
      baseUrl = process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
      modelName = process.env.QWEN_MODEL || "qwen-plus";
    }

    if (!apiKey) throw new Error(`${engine.toUpperCase()} API Key missing`);
    const safeBaseUrl = baseUrl || "https://api.openai.com/v1";

    const response = await fetch(`${safeBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: "Amazon SEO expert. JSON only." },
          { role: "user", content: UNIFIED_OPTIMIZE_PROMPT(brand, infringementWords, Date.now()) + `\n\n[SOURCE DATA]\n${JSON.stringify(cleanedData)}` }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const tokens = data.usage?.total_tokens || 0;
    return new Response(JSON.stringify({ data: JSON.parse(content), tokens }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
