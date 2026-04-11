import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

console.log(">>> SERVER.TS IS STARTING UP <<<");

// Static imports for AI services
import { optimizeListingWithQwen, translateListingWithQwen } from "./services/qwenService";
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from "./services/openaiService";
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from "./services/deepseekService";
import { optimizeListingWithAI, translateListingWithAI } from "./services/geminiService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request Logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Health check & Test routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/test", (req, res) => {
    res.json({ message: "API is reachable", method: req.method });
  });

  // API Route for AI Optimization
  app.post("/api/ai/optimize", async (req, res, next) => {
    const { engine, cleanedData, infringementWords } = req.body;
    console.log(`Optimizing with ${engine}...`);
    
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
    } catch (error) {
      next(error);
    }
  });

  // API Route for AI Translation
  app.post("/api/ai/translate", async (req, res, next) => {
    const { engine, sourceData, targetLangName } = req.body;
    console.log(`Translating to ${targetLangName} with ${engine}...`);
    
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
    } catch (error) {
      next(error);
    }
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    console.warn(`404 on API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
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

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ 
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
