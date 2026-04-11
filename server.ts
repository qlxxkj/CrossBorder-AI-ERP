import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// Static imports for AI services
import { optimizeListingWithQwen, translateListingWithQwen } from "./services/qwenService.ts";
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from "./services/openaiService.ts";
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from "./services/deepseekService.ts";
import { optimizeListingWithAI, translateListingWithAI } from "./services/geminiService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route for AI Optimization
  app.post("/api/ai/optimize", async (req, res) => {
    const { engine, cleanedData, infringementWords } = req.body;
    
    try {
      let result;
      if (engine === 'qwen') {
        result = await optimizeListingWithQwen(cleanedData, infringementWords);
      } else if (engine === 'openai') {
        result = await optimizeListingWithOpenAI(cleanedData, infringementWords);
      } else if (engine === 'deepseek') {
        result = await optimizeListingWithDeepSeek(cleanedData, infringementWords);
      } else {
        result = await optimizeListingWithAI(cleanedData, infringementWords);
      }
      res.json(result);
    } catch (error: any) {
      console.error(`Server AI Error (${engine}):`, error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route for AI Translation
  app.post("/api/ai/translate", async (req, res) => {
    const { engine, sourceData, targetLangName } = req.body;
    
    try {
      let result;
      if (engine === 'qwen') {
        result = await translateListingWithQwen(sourceData, targetLangName);
      } else if (engine === 'openai') {
        result = await translateListingWithOpenAI(sourceData, targetLangName);
      } else if (engine === 'deepseek') {
        result = await translateListingWithDeepSeek(sourceData, targetLangName);
      } else {
        result = await translateListingWithAI(sourceData, targetLangName);
      }
      res.json(result);
    } catch (error: any) {
      console.error(`Server Translation Error (${engine}):`, error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API 404 handler
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
