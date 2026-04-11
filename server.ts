import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route for AI Optimization
  app.post("/api/ai/optimize", async (req, res) => {
    const { engine, cleanedData, infringementWords } = req.body;
    
    try {
      let result;
      if (engine === 'qwen') {
        const { optimizeListingWithQwen } = await import("./services/qwenService.js");
        result = await optimizeListingWithQwen(cleanedData, infringementWords);
      } else if (engine === 'openai') {
        const { optimizeListingWithOpenAI } = await import("./services/openaiService.js");
        result = await optimizeListingWithOpenAI(cleanedData, infringementWords);
      } else if (engine === 'deepseek') {
        const { optimizeListingWithDeepSeek } = await import("./services/deepseekService.js");
        result = await optimizeListingWithDeepSeek(cleanedData, infringementWords);
      } else {
        const { optimizeListingWithAI } = await import("./services/geminiService.js");
        result = await optimizeListingWithAI(cleanedData, infringementWords);
      }
      res.json(result);
    } catch (error: any) {
      console.error(`Server AI Error (${engine}):`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for AI Translation
  app.post("/api/ai/translate", async (req, res) => {
    const { engine, sourceData, targetLangName } = req.body;
    
    try {
      let result;
      if (engine === 'qwen') {
        const { translateListingWithQwen } = await import("./services/qwenService.js");
        result = await translateListingWithQwen(sourceData, targetLangName);
      } else if (engine === 'openai') {
        const { translateListingWithOpenAI } = await import("./services/openaiService.js");
        result = await translateListingWithOpenAI(sourceData, targetLangName);
      } else if (engine === 'deepseek') {
        const { translateListingWithDeepSeek } = await import("./services/deepseekService.js");
        result = await translateListingWithDeepSeek(sourceData, targetLangName);
      } else {
        const { translateListingWithAI } = await import("./services/geminiService.js");
        result = await translateListingWithAI(sourceData, targetLangName);
      }
      res.json(result);
    } catch (error: any) {
      console.error(`Server Translation Error (${engine}):`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
