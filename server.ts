import express from "express";
import path from "path";
import { fileURLToPath } from "url";

console.log(">>> [BOOT] SERVER.TS IS STARTING UP <<<");
console.log(">>> [BOOT] NODE_ENV:", process.env.NODE_ENV);
console.log(">>> [BOOT] CWD:", process.cwd());

// Static imports removed to prevent startup crashes
import { fileURLToPath } from "url";

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

  // 1. API ROUTES (Directly on app for maximum compatibility)
  app.get("/api/health", (req, res) => {
    console.log(`[API] Health check: ${req.method} ${req.url}`);
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/ping", (req, res) => {
    res.send("pong");
  });

  app.get("/api/debug", (req, res) => {
    res.json({
      node_env: process.env.NODE_ENV,
      has_qwen_key: !!process.env.QWEN_API_KEY,
      has_openai_key: !!process.env.OPENAI_API_KEY,
      has_deepseek_key: !!process.env.DEEPSEEK_API_KEY,
      has_gemini_key: !!process.env.GEMINI_API_KEY,
    });
  });

  app.post("/api/ai/optimize", async (req, res, next) => {
    const { engine, cleanedData, infringementWords } = req.body;
    console.log(`[API] AI Optimize: ${engine}`);
    try {
      let result;
      if (engine === 'qwen') {
        const { optimizeListingWithQwen } = await import("./services/qwenService");
        result = await optimizeListingWithQwen(cleanedData, infringementWords);
      } else if (engine === 'openai') {
        const { optimizeListingWithOpenAI } = await import("./services/openaiService");
        result = await optimizeListingWithOpenAI(cleanedData, infringementWords);
      } else if (engine === 'deepseek') {
        const { optimizeListingWithDeepSeek } = await import("./services/deepseekService");
        result = await optimizeListingWithDeepSeek(cleanedData, infringementWords);
      } else {
        const { optimizeListingWithAI } = await import("./services/geminiService");
        result = await optimizeListingWithAI(cleanedData, infringementWords);
      }
      res.json(result);
    } catch (error: any) {
      console.error(`[API] AI Optimize Error: ${error.message}`);
      next(error);
    }
  });

  app.post("/api/ai/translate", async (req, res, next) => {
    const { engine, sourceData, targetLangName } = req.body;
    console.log(`[API] AI Translate: ${targetLangName}`);
    try {
      let result;
      if (engine === 'qwen') {
        const { translateListingWithQwen } = await import("./services/qwenService");
        result = await translateListingWithQwen(sourceData, targetLangName);
      } else if (engine === 'openai') {
        const { translateListingWithOpenAI } = await import("./services/openaiService");
        result = await translateListingWithOpenAI(sourceData, targetLangName);
      } else if (engine === 'deepseek') {
        const { translateListingWithDeepSeek } = await import("./services/deepseekService");
        result = await translateListingWithDeepSeek(sourceData, targetLangName);
      } else {
        const { translateListingWithAI } = await import("./services/geminiService");
        result = await translateListingWithAI(sourceData, targetLangName);
      }
      res.json(result);
    } catch (error: any) {
      console.error(`[API] AI Translate Error: ${error.message}`);
      next(error);
    }
  });

  // 2. VITE / STATIC MIDDLEWARE

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in middleware mode...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to load Vite middleware:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
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
