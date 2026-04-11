import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Static imports for AI services
import { optimizeListingWithQwen, translateListingWithQwen } from "./services/qwenService";
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from "./services/openaiService";
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from "./services/deepseekService";
import { optimizeListingWithAI, translateListingWithAI } from "./services/geminiService";

console.log(">>> [BOOT] SERVER.TS IS STARTING UP <<<");
console.log(">>> [BOOT] NODE_ENV:", process.env.NODE_ENV);
console.log(">>> [BOOT] CWD:", process.cwd());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

// 1. MIDDLEWARE
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 2. API ROUTES
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/ping", (req, res) => {
  res.send("pong");
});

app.get("/api/debug", (req, res) => {
  res.json({
    node_env: process.env.NODE_ENV,
    is_vercel: !!process.env.VERCEL,
    has_qwen_key: !!process.env.QWEN_API_KEY,
  });
});

app.post("/api/ai/optimize", async (req, res, next) => {
  const { engine, cleanedData, infringementWords } = req.body;
  console.log(`[API] AI Optimize Start - Engine: ${engine}`);
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
    console.log("[API] AI Optimize Success");
    res.json(result);
  } catch (error: any) {
    console.error(`[API] AI Optimize CRITICAL ERROR: ${error.message}`);
    res.status(500).json({ 
      error: error.message, 
      engine: engine,
      tip: "If this is a timeout, try a faster model or check Vercel logs."
    });
  }
});

app.post("/api/ai/translate", async (req, res, next) => {
  const { engine, sourceData, targetLangName } = req.body;
  console.log(`[API] AI Translate Start - Target: ${targetLangName}`);
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
    console.error(`[API] AI Translate ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 3. VITE / STATIC
async function configureStatic() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Vite middleware error:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

configureStatic();

// 4. ERROR HANDLER
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// 5. LISTEN
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
