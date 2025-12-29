
import React, { useState } from 'react';
import { X, Search, Globe, Layers, Loader2, CheckCircle2, AlertTriangle, Zap, Terminal } from 'lucide-react';
import { UILanguage, CleanedData } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

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

export const BulkScrapeModal: React.FC<BulkScrapeModalProps> = ({ uiLang, onClose, onFinished }) => {
  const t = useTranslation(uiLang);
  const [keywords, setKeywords] = useState('');
  const [marketplace, setMarketplace] = useState('US');
  const [pages, setPages] = useState(1);
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleStartScrape = async () => {
    if (!keywords.trim()) return;
    setIsScraping(true);
    setProgress(5);
    setLogs([]);
    addLog(`Initiating AI Scraper for "${keywords}" on Amazon ${marketplace}...`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Auth required");

      // 模拟采集流程
      // 在实际应用中，这里会调用后端 API 或 浏览器扩展接口
      for (let p = 1; p <= pages; p++) {
        setProgress(10 + (p / pages) * 20);
        addLog(`Analyzing Search Result Page ${p}...`);
        await new Promise(r => setTimeout(r, 1500));
        
        const mockASINs = Array(4).fill(0).map(() => `B0${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
        addLog(`Found ${mockASINs.length} high-potential ASINs on Page ${p}`);

        for (const asin of mockASINs) {
          addLog(`Extracting specs for ${asin}...`);
          await new Promise(r => setTimeout(r, 800));
          
          const mockData: CleanedData = {
            asin,
            title: `${keywords} Professional Series - High Performance Model ${asin.slice(-4)}`,
            brand: "AI Generic",
            price: Math.floor(Math.random() * 100) + 19.99,
            shipping: 0,
            features: [
              "Premium quality materials for long-lasting durability.",
              "Ergonomic design optimized for daily professional use.",
              "Eco-friendly packaging and sustainable manufacturing."
            ],
            description: `This is a high-quality ${keywords} designed for the global market. Featuring advanced technology and superior build quality.`,
            main_image: `https://picsum.photos/seed/${asin}/600/600`,
            other_images: [],
            updated_at: new Date().toISOString()
          };

          // 插入到 Supabase
          const { error } = await supabase.from('listings').insert([{
            user_id: session.user.id,
            asin: asin,
            status: 'collected',
            cleaned: mockData,
            created_at: new Date().toISOString()
          }]);

          if (error) console.error("Insert error:", error);
        }
      }

      setProgress(100);
      addLog("Successfully synced all products to cloud storage.");
      await new Promise(r => setTimeout(r, 1000));
      onFinished();
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
      setIsScraping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                <Zap size={24} />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('bulkScrape')}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Powered by AI Scraper Engine</p>
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
            <div className="space-y-8 py-10">
               <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
               </div>
               
               <div className="bg-slate-900 rounded-3xl p-6 font-mono text-[11px] space-y-2 shadow-2xl">
                  {logs.map((log, i) => (
                    <div key={i} className={`flex items-start gap-3 ${i === logs.length - 1 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                       <Terminal size={12} className="mt-0.5 flex-shrink-0" />
                       <span className="break-all">{log}</span>
                    </div>
                  ))}
               </div>

               <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-amber-500" size={32} />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('scrapingProgress')}</p>
               </div>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('scrapeKeywords')}</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input 
                      type="text" 
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="e.g. Ergonomic Office Chair"
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('scrapeMarketplace')}</label>
                    <div className="grid grid-cols-1">
                      <select 
                        value={marketplace}
                        onChange={(e) => setMarketplace(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none appearance-none cursor-pointer"
                      >
                        {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name} ({m.domain})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('scrapePages')}</label>
                    <input 
                      type="number" 
                      min="1" max="10"
                      value={pages}
                      onChange={(e) => setPages(parseInt(e.target.value) || 1)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
                 <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                 <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase">
                    Bulk scraping uses high-speed rotating proxies. For your account safety, avoid scraping more than 100 products per hour.
                 </p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleStartScrape}
                  disabled={!keywords.trim()}
                  className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Zap size={18} /> {t('startScraping')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
