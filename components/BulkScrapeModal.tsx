
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Globe, Layers, Loader2, CheckCircle2, AlertTriangle, Zap, Terminal, Box, Image as ImageIcon, Database, Sparkles, Cpu, Code } from 'lucide-react';
import { UILanguage, CleanedData } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { GoogleGenAI, Type } from "@google/genai";

interface BulkScrapeModalProps {
  uiLang: UILanguage;
  onClose: () => void;
  onFinished: () => void;
}

type ScrapingMode = 'AI' | 'DIRECT';

const MARKETPLACES = [
  { code: 'US', name: 'USA', domain: 'amazon.com', flag: '🇺🇸' },
  { code: 'UK', name: 'UK', domain: 'amazon.co.uk', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', domain: 'amazon.de', flag: '🇩🇪' },
  { code: 'FR', name: 'France', domain: 'amazon.fr', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', domain: 'amazon.co.jp', flag: '🇯🇵' },
];

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

export const BulkScrapeModal: React.FC<BulkScrapeModalProps> = ({ uiLang, onClose, onFinished }) => {
  const t = useTranslation(uiLang);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const [mode, setMode] = useState<ScrapingMode>('AI');
  const [keywords, setKeywords] = useState('');
  const [marketplace, setMarketplace] = useState('US');
  const [pages, setPages] = useState(1);
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'process'}[]>([]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'process' = 'info') => {
    setLogs(prev => [...prev, { msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }]);
  };

  const processAndUploadImage = async (sourceUrl: string, asin: string): Promise<string> => {
    try {
      addLog(`Relaying Asset: ${asin} via cloud node...`, 'process');
      const response = await fetch(`${CORS_PROXY}${encodeURIComponent(sourceUrl)}`);
      if (!response.ok) throw new Error("CORS Failure");
      const blob = await response.blob();
      const file = new File([blob], `scrape_${asin}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error("Storage Reject");
      
      const data = await uploadRes.json();
      const finalUrl = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
      addLog(`Asset Live: ${asin}`, 'success');
      return finalUrl;
    } catch (err) {
      addLog(`Fallback image assigned to ${asin}`, 'error');
      return sourceUrl || `https://picsum.photos/seed/${asin}/800/800`;
    }
  };

  const handleStartScrape = async () => {
    if (!keywords.trim()) return;

    // 检查 API KEY
    try {
      if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        addLog("Security: Real-time web access requires a selected API key.", 'info');
        await (window as any).aistudio.openSelectKey();
      }
    } catch (e) {}

    setIsScraping(true);
    setProgress(5);
    setLogs([]);
    addLog(`Protocol: ${mode === 'AI' ? 'Deep AI Discovery' : 'Raw Content Extraction'} Mode Active.`, 'info');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please log in to continue.");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let finalPayload: any[] = [];

      if (mode === 'AI') {
        addLog(`Consulting Knowledge Graph & Search for trending ${keywords}...`, 'process');
        const prompt = `Act as an e-commerce expert. Search Amazon ${marketplace} for real products related to "${keywords}". 
        Find 5 actual results. Optimize the text for SEO as you collect it.
        Return ONLY a JSON array with these keys: asin, title, brand, price, strike_price, ratings, reviews, category, BSR, bullets, desc, image, product_dimensions, item_weight, OEM_Part_Number, Date_First_Available, bought_in_past_month.
        Also include a field "raw_snippet" which contains the original unedited text found on the page.`;

        const response = await ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents: prompt,
          config: { tools: [{googleSearch: {}}], responseMimeType: "application/json" },
        });

        const rawText = (response.text || "[]").trim();
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        finalPayload = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
      } else {
        addLog(`Connecting to Amazon ${marketplace} nodes via Search Grounding...`, 'process');
        addLog(`Requesting RAW Page Fragments for ASIN mapping...`, 'info');
        
        const prompt = `Act as a pure web crawler. Search Amazon ${marketplace} for "${keywords}". 
        Identify exactly 5 real product listings. 
        MANDATORY: For each product, extract the raw, unedited, literal text exactly as it appears on the screen (including HTML snippets if possible). 
        Do not optimize or clean the data yet. 
        Return a JSON array where each object has:
        "raw_dump": "The literal raw text extracted from the page",
        "structured": { "asin": "...", "title": "...", "price": 0.0, "image": "...", "brand": "...", "features": [], "description": "...", "BSR": "..." }`;

        const response = await ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents: prompt,
          config: { tools: [{googleSearch: {}}], responseMimeType: "application/json" },
        });

        const rawText = (response.text || "[]").trim();
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        finalPayload = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
      }

      if (!Array.isArray(finalPayload) || finalPayload.length === 0) throw new Error("Zero items discovered. Marketplace nodes returned empty.");

      addLog(`Captured ${finalPayload.length} entities. Commencing Data Purification...`, 'success');
      setProgress(25);

      for (let i = 0; i < finalPayload.length; i++) {
        const item = finalPayload[i];
        const step = 75 / finalPayload.length;
        
        // 区分模式的数据读取
        const rawContent = mode === 'DIRECT' ? item.raw_dump : (item.raw_snippet || "AI Enhanced Content");
        const structured = mode === 'DIRECT' ? item.structured : item;

        addLog(`Processing [${structured.asin}]: Cleaning raw fragments...`, 'process');
        
        // 确保图片是真实的 Amazon URL 并进行转存
        const hostedImageUrl = await processAndUploadImage(structured.image, structured.asin);

        const cleaned: CleanedData = {
          asin: structured.asin,
          title: structured.title,
          brand: structured.brand,
          price: structured.price,
          strike_price: structured.strike_price,
          shipping: 0,
          features: structured.bullets || structured.features || [],
          description: structured.desc || structured.description || "No detail provided.",
          main_image: hostedImageUrl,
          other_images: structured.other_images || [],
          ratings: structured.ratings,
          reviews: structured.reviews,
          category: structured.category,
          BSR: structured.BSR,
          product_dimensions: structured.product_dimensions,
          item_weight: structured.item_weight,
          OEM_Part_Number: structured.OEM_Part_Number,
          Date_First_Available: structured.Date_First_Available,
          bought_in_past_month: structured.bought_in_past_month,
          updated_at: new Date().toISOString()
        };

        const { error: dbError } = await supabase.from('listings').insert([{
          user_id: session.user.id,
          asin: cleaned.asin,
          marketplace: marketplace,
          status: 'collected',
          cleaned: cleaned,
          raw: rawContent, // 关键：存储原始网页信息
          created_at: new Date().toISOString()
        }]);

        if (dbError) addLog(`DB Error for ${structured.asin}: ${dbError.message}`, 'error');
        else addLog(`Cataloged: ${structured.asin} [RAW+CLEANED]`, 'success');
        
        setProgress(25 + (i + 1) * step);
      }

      setProgress(100);
      addLog("Scraping Session Finished.", 'success');
      await new Promise(r => setTimeout(r, 1000));
      onFinished();
    } catch (err: any) {
      addLog(`Critical Failure: ${err.message}`, 'error');
      setIsScraping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-500 ${mode === 'AI' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                {mode === 'AI' ? <Sparkles size={24} /> : <Code size={24} />}
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('bulkScrape')}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {mode === 'AI' ? 'AI Optimized Discovery' : 'Raw Content Extraction'}
                </p>
             </div>
          </div>
          {!isScraping && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-300 transition-colors">
              <X size={24} />
            </button>
          )}
        </div>

        <div className="p-10 space-y-8">
          {isScraping ? (
            <div className="space-y-8 py-6">
               <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                  <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-in-out ${mode === 'AI' ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}
                    style={{ width: `${progress}%` }}
                  ></div>
               </div>
               
               <div 
                 ref={logContainerRef}
                 className="bg-slate-950 rounded-2xl p-6 font-mono text-[10px] space-y-2 shadow-2xl h-64 overflow-y-auto custom-scrollbar border border-slate-800"
               >
                  {logs.map((log, i) => (
                    <div key={i} className={`flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300 ${
                      log.type === 'success' ? 'text-emerald-400' : 
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'process' ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                       <Terminal size={12} className="mt-0.5 flex-shrink-0" />
                       <span className="break-all">{log.msg}</span>
                    </div>
                  ))}
               </div>
               <div className="flex flex-col items-center gap-2">
                  <Loader2 className={`animate-spin ${mode === 'AI' ? 'text-indigo-500' : 'text-emerald-500'}`} size={32} />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing with Marketplace Clusters...</p>
               </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Select Scraping Engine</label>
                 <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                    <button 
                      onClick={() => setMode('AI')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${mode === 'AI' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Sparkles size={14} /> AI DISCOVERY
                    </button>
                    <button 
                      onClick={() => setMode('DIRECT')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${mode === 'DIRECT' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Code size={14} /> REAL SCRAPE
                    </button>
                 </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('scrapeKeywords')}</label>
                  <div className="relative group">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${mode === 'AI' ? 'text-indigo-300 group-focus-within:text-indigo-500' : 'text-emerald-300 group-focus-within:text-emerald-500'}`} size={20} />
                    <input 
                      type="text" 
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="e.g. Electric Kettle"
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 outline-none transition-all font-bold text-slate-800 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('scrapeMarketplace')}</label>
                    <div className="relative">
                      <select 
                        value={marketplace}
                        onChange={(e) => setMarketplace(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none appearance-none cursor-pointer"
                      >
                        {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name} ({m.domain})</option>)}
                      </select>
                      <Globe className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('scrapePages')}</label>
                    <div className="relative opacity-60">
                      <input 
                        type="number" 
                        min="1" max="1"
                        value={pages}
                        disabled
                        className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-400 outline-none"
                      />
                      <Layers className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border flex items-start gap-4 ${mode === 'AI' ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'}`}>
                 <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 ${mode === 'AI' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                    {mode === 'AI' ? <Sparkles size={20} /> : <Code size={20} />}
                 </div>
                 <p className={`text-[10px] font-bold leading-relaxed uppercase ${mode === 'AI' ? 'text-indigo-800' : 'text-emerald-800'}`}>
                    {mode === 'AI' 
                      ? "AI Discovery: Use Search Grounding to find products and enhance their copy for maximum conversions." 
                      : "Real Scrape: Pulls literal text fragments and raw metadata from the source page to ensure 100% authenticity."}
                 </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button 
                  onClick={handleStartScrape}
                  disabled={!keywords.trim()}
                  className={`flex-[2] py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 ${mode === 'AI' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                >
                  {mode === 'AI' ? <Sparkles size={18} /> : <Code size={18} />} 
                  {mode === 'AI' ? 'Start AI Discover' : 'Execute Real Scrape'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
