
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Globe, Layers, Loader2, Zap, Terminal, Code, Sparkles, Cpu } from 'lucide-react';
import { UILanguage, CleanedData } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase } from '../lib/supabaseClient';
import { GoogleGenAI } from "@google/genai";

interface BulkScrapeModalProps {
  uiLang: UILanguage;
  onClose: () => void;
  onFinished: () => void;
}

const MARKETPLACES = [
  { code: 'US', name: 'USA', domain: 'amazon.com', flag: '🇺🇸' },
  { code: 'UK', name: 'UK', domain: 'amazon.co.uk', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', domain: 'amazon.de', flag: '🇩🇪' },
  { code: 'FR', name: 'France', domain: 'amazon.fr', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', domain: 'amazon.co.jp', flag: '🇯🇵' },
];

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const CORS_PROXY = 'https://corsproxy.io/?';

export const BulkScrapeModal: React.FC<BulkScrapeModalProps> = ({ uiLang, onClose, onFinished }) => {
  const t = useTranslation(uiLang);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const [keywords, setKeywords] = useState('');
  const [marketplace, setMarketplace] = useState('US');
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'process'}[]>([]);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'process' = 'info') => {
    setLogs(prev => [...prev, { msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }]);
  };

  const uploadImage = async (url: string, asin: string): Promise<string> => {
    try {
      addLog(`[ASSET] Syncing image for ${asin}...`, 'process');
      const res = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('file', new File([blob], `${asin}.jpg`, { type: 'image/jpeg' }));
      
      const uploadRes = await fetch(`${IMAGE_HOST_DOMAIN}/upload`, { method: 'POST', body: formData });
      const data = await uploadRes.json();
      const finalUrl = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
      return finalUrl || url;
    } catch (e) {
      addLog(`[ASSET] Image relay failed for ${asin}, using source.`, 'error');
      return url;
    }
  };

  const handleStartScrape = async () => {
    if (!keywords.trim()) return;

    // 检查 API KEY
    if (!process.env.API_KEY) {
      alert("Missing API_KEY. Please check your environment variables.");
      return;
    }

    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && !(await aistudio.hasSelectedApiKey())) {
        addLog("Security: Real-time discovery requires API Key selection.", 'info');
        await aistudio.openSelectKey();
      }
    } catch (e) {}

    setIsScraping(true);
    setProgress(5);
    setLogs([]);
    addLog(`Engine: Deep Content Scraper activated. Targeting Amazon ${marketplace}.`, 'info');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Auth required");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      addLog(`Grounding: Accessing live marketplace nodes for "${keywords}"...`, 'process');
      
      const prompt = `Act as an e-commerce scraper. Use Google Search to find exactly 5 REAL products currently listed on Amazon ${marketplace} that match "${keywords}". 
      Instructions:
      1. For each product, extract real data. 
      2. Format as a JSON array where each object has:
         - RAW_DUMP: literal text snippet from the page.
         - STRUCTURED: { asin, title, brand, price, image_url, bullet_points[], description, bsr, ratings }.
      Return ONLY the raw JSON array. No conversational text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: prompt,
        config: { 
          tools: [{googleSearch: {}}], 
          responseMimeType: "application/json" 
        },
      });

      let rawJsonText = response.text || "[]";
      // 清洗 Markdown 代码块，防止 JSON 解析报错
      rawJsonText = rawJsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let products;
      try {
        products = JSON.parse(rawJsonText);
      } catch (pErr) {
        addLog("Data structure corruption detected. Retrying with loose extraction...", 'error');
        // 尝试通过正则找数组
        const match = rawJsonText.match(/\[[\s\S]*\]/);
        if (match) products = JSON.parse(match[0]);
        else throw new Error("Invalid AI Response format.");
      }

      if (!Array.isArray(products) || products.length === 0) throw new Error("Empty marketplace response.");

      addLog(`Captured ${products.length} entities. Commencing purification...`, 'success');
      setProgress(20);

      // 单个产品处理循环，确保错误不扩散
      for (let i = 0; i < products.length; i++) {
        const item = products[i];
        const step = 80 / products.length;
        
        try {
          const struct = item.STRUCTURED || item;
          const rawText = item.RAW_DUMP || "Original web content captured.";

          if (!struct.asin) {
            addLog(`Index ${i+1}: Missing ASIN, skipping.`, 'process');
            continue;
          }

          addLog(`[${struct.asin}] Extracting metadata...`, 'process');

          const hostedImage = await uploadImage(struct.image_url || struct.image, struct.asin);

          const cleaned: CleanedData = {
            asin: struct.asin,
            title: struct.title,
            brand: struct.brand || "Authentic",
            price: parseFloat(String(struct.price).replace(/[^0-9.]/g, '')) || 0,
            features: Array.isArray(struct.bullet_points) ? struct.bullet_points : (struct.features || []),
            description: struct.description || struct.desc || "",
            main_image: hostedImage,
            ratings: struct.ratings,
            BSR: struct.bsr,
            updated_at: new Date().toISOString()
          };

          const { error: dbError } = await supabase.from('listings').insert([{
            user_id: session.user.id,
            asin: cleaned.asin,
            marketplace,
            status: 'collected',
            cleaned,
            raw: rawText, 
            created_at: new Date().toISOString()
          }]);

          if (dbError) {
            // 如果是因为唯一约束报错，则记录
            if (dbError.code === '23505') {
              addLog(`[${struct.asin}] Record already exists, skipping.`, 'info');
            } else {
              addLog(`[${struct.asin}] DB Sync error: ${dbError.message}`, 'error');
            }
          } else {
            addLog(`[${struct.asin}] Successfully cataloged.`, 'success');
          }

        } catch (itemErr: any) {
          addLog(`Error at entry ${i+1}: ${itemErr.message}`, 'error');
        }
        
        setProgress(20 + (i + 1) * step);
        // 微量延时，平滑进度
        await new Promise(r => setTimeout(r, 300));
      }

      setProgress(100);
      addLog("Scraping cycle finalized.", 'success');
      setTimeout(onFinished, 1200);
    } catch (err: any) {
      addLog(`Critical Failure: ${err.message}`, 'error');
      setIsScraping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Zap size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Real Discovery</h2>
          </div>
          {!isScraping && <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={24} /></button>}
        </div>

        <div className="p-8 space-y-6">
          {isScraping ? (
            <div className="space-y-6">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-500 shadow-[0_0_8px_rgba(79,70,229,0.5)]" style={{ width: `${progress}%` }}></div>
              </div>
              <div ref={logContainerRef} className="bg-slate-950 rounded-2xl p-5 font-mono text-[10px] h-64 overflow-y-auto custom-scrollbar border border-slate-800 space-y-1">
                {logs.map((l, i) => (
                  <div key={i} className={`flex items-start gap-2 animate-in slide-in-from-left-2 duration-300 ${l.type === 'success' ? 'text-emerald-400' : l.type === 'error' ? 'text-red-400' : l.type === 'process' ? 'text-amber-400' : 'text-slate-400'}`}>
                    <Terminal size={10} className="mt-0.5 shrink-0" />
                    <span className="break-all">{l.msg}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-indigo-500" size={24} />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Collecting authentic data...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('scrapeKeywords')}</label>
                  <input 
                    type="text" 
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="e.g. Memory Foam Pillow"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none transition-all font-bold text-slate-800 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('scrapeMarketplace')}</label>
                    <select 
                      value={marketplace}
                      onChange={(e) => setMarketplace(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Limit</label>
                    <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl font-black text-slate-400 text-sm">5 Items</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3">
                <div className="bg-white p-2 rounded-lg text-indigo-600 h-fit shadow-sm"><Code size={16} /></div>
                <p className="text-[10px] font-bold text-indigo-800 leading-relaxed uppercase">
                  Real Scrape Mode: AI will visit Amazon live via Google Search to capture raw fragments and structural data.
                </p>
              </div>

              <div className="flex gap-4 pt-2">
                <button onClick={onClose} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button 
                  onClick={handleStartScrape}
                  disabled={!keywords.trim()}
                  className="flex-[2] py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-800 active:scale-95 transition-all"
                >
                  <Sparkles size={16} /> Execute Real Scrape
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
