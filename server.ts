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

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Debug middleware for ALL requests
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API DEBUG] ${req.method} ${req.url}`);
    }
    next();
  });

  // 1. API ROUTES (Must be before Vite/Static)
  const apiRouter = express.Router();

  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  apiRouter.get("/test", (req, res) => {
    res.json({ message: "API Router is working" });
  });

  // AI Optimization
  apiRouter.all("/ai/optimize", async (req, res, next) => {
    if (req.method === 'GET') {
      return res.json({ message: "AI Optimize endpoint is alive. Use POST to optimize." });
    }
    
    const { engine, cleanedData, infringementWords } = req.body;
    console.log(`[API] AI Optimize - Engine: ${engine}`);
    
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

  // AI Translation
  apiRouter.all("/ai/translate", async (req, res, next) => {
    if (req.method === 'GET') {
      return res.json({ message: "AI Translate endpoint is alive. Use POST to translate." });
    }

    const { engine, sourceData, targetLangName } = req.body;
    console.log(`[API] AI Translate - Target: ${targetLangName}`);
    
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
  apiRouter.all("*", (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  app.use("/api", apiRouter);

  // 2. VITE / STATIC MIDDLEWARE

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
