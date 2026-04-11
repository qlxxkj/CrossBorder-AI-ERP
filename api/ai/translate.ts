
import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { engine, sourceData, targetLangName } = await req.json();
    const prompt = `Translate to "${targetLangName}". JSON ONLY. Keys: optimized_title, optimized_features, optimized_description, search_keywords. NO brands. Data: ${JSON.stringify(sourceData)}`;

    if (engine === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY missing");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = response.text || "";
      const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || "{}";
      return new Response(jsonStr, { headers: { 'Content-Type': 'application/json' } });
    }

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
          { role: "system", content: "Professional Amazon translator. JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    return new Response(content, { headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
