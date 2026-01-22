
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  Globe, Languages, Loader2, DollarSign, Truck, Save, ChevronRight,
  Zap, Weight, Ruler, ListFilter, FileText, Wand2, Search, 
  ExternalLink, Link2, Star, Box, Hash, Cpu, Brain
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, ExchangeRate, SourcingRecord } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from '../services/openaiService';
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from '../services/deepseekService';
import { ImageEditor } from './ImageEditor';
import { SourcingModal } from './SourcingModal';
import { SourcingFormModal } from './SourcingFormModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onNext: () => void;
  uiLang: UILanguage;
}

type AIEngine = 'gemini' | 'openai' | 'deepseek';

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

const MARKET_LANG_MAP: Record<string, string> = {
  'DE': 'German', 'FR': 'French', 'IT': 'Italian', 'ES': 'Spanish', 
  'JP': 'Japanese', 'PL': 'Polish', 'NL': 'Dutch', 'SE': 'Swedish', 
  'BR': 'Portuguese', 'MX': 'Spanish', 'EG': 'Arabic', 'BE': 'French',
  'TR': 'Turkish', 'SA': 'Arabic', 'AE': 'Arabic'
};

const parseNumeric = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};

const getAmazonStandardUnit = (unit: string | undefined, market: string) => {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  if (/[^\x00-\x7F]/.test(unit)) return unit;
  if (['EG', 'SA', 'AE'].includes(market)) {
    const arMap: Record<string, string> = { 'kg': 'كيلوجرام', 'lb': 'رطل', 'in': 'بوصة', 'cm': 'سنتيمتر' };
    return arMap[u] || unit;
  }
  if (market === 'JP') {
    const jpMap: Record<string, string> = { 'lb': 'ポンド', 'kg': 'キログラム', 'in': 'インチ', 'cm': 'センチメートル' };
    return jpMap[u] || unit;
  }
  const standardMap: Record<string, string> = { 'lb': 'Pounds', 'kg': 'Kilograms', 'in': 'Inches', 'cm': 'Centimeters' };
  return standardMap[u] || (unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase());
};

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<AIEngine>(() => (localStorage.getItem('amzbot_preferred_engine') as AIEngine) || 'gemini');

  useEffect(() => { localStorage.setItem('amzbot_preferred_engine', engine); }, [engine]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, market: '' });
  const [translatingMarkets, setTranslatingMarkets] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [previewImage, setPreviewImage] = useState<string>(listing.cleaned?.main_image || '');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    setLocalListing(listing);
    setPreviewImage(listing.cleaned?.main_image || '');
    fetchPricingData();
  }, [listing]);

  const fetchPricingData = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('exchange_rates').select('*');
    if (data) setExchangeRates(data);
  };

  const syncToSupabase = async (targetListing: Listing) => {
    if (!isSupabaseConfigured()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('listings').update({
        cleaned: targetListing.cleaned,
        optimized: targetListing.optimized || null,
        translations: targetListing.translations || null,
        status: targetListing.status,
        sourcing_data: targetListing.sourcing_data || [],
        updated_at: new Date().toISOString()
      }).eq('id', targetListing.id);
      if (error) throw error;
    } catch (e) { console.error("Supabase Sync Failed:", e); } 
    finally { setIsSaving(false); }
  };

  const getFieldValue = (optField: string, cleanField: string) => {
    const isUS = activeMarket === 'US';
    const sourceData = isUS ? localListing.optimized : localListing.translations?.[activeMarket];
    
    // 1. 特殊处理：五点描述
    if (optField === 'optimized_features') {
      const rawFeats = sourceData ? ((sourceData as any)['optimized_features'] || (sourceData as any)['features'] || (sourceData as any)['bullet_points']) : null;
      let feats: string[] = [];
      if (Array.isArray(rawFeats)) {
        feats = rawFeats.map(f => String(f || "").trim());
      } else if (typeof rawFeats === 'string' && rawFeats.trim() !== '') {
        feats = rawFeats.split('\n').map(f => f.trim()).filter(Boolean);
      }
      
      // 严苛显示逻辑：如果是翻译站且数据对象存在，即便为空也显示空，不填充 Master
      if (!isUS && sourceData) {
        const result = [...feats];
        while (result.length < 5) result.push('');
        return result.slice(0, 5);
      }

      // 如果是美国站，允许回退到采集的原始 cleaned 数据
      if (isUS && feats.length === 0) {
        feats = (localListing.cleaned?.bullet_points || localListing.cleaned?.features || []).filter(Boolean);
      }

      const result = [...feats];
      while (result.length < 5) result.push('');
      return result.slice(0, 5);
    }

    // 2. 普通字段逻辑
    let val = sourceData ? (sourceData as any)[optField] : null;

    // 严苛模式：如果是翻译站点且数据对象存在，直接返回结果（即使是空字符串）
    if (!isUS && sourceData) {
      return val || "";
    }

    // 如果是美国站，允许 fallback 到 Master (cleaned) 数据
    if (isUS) {
      return val || (localListing.cleaned as any)[cleanField] || "";
    }

    return "";
  };

  const updateField = (field: string, value: any) => {
    const nextListing = { ...localListing };
    if (activeMarket === 'US') {
      if (field === 'main_image' || field === 'other_images') {
        nextListing.cleaned = { ...nextListing.cleaned, [field]: value };
      } else {
        nextListing.optimized = { ...(nextListing.optimized || {}), [field]: value } as OptimizedData;
      }
    } else {
      const currentTranslations = { ...(nextListing.translations || {}) };
      const currentTrans = currentTranslations[activeMarket] || { optimized_title: '', optimized_features: ['', '', '', '', ''], optimized_description: '', search_keywords: '' } as OptimizedData;
      currentTranslations[activeMarket] = { ...currentTrans, [field]: value };
      nextListing.translations = currentTranslations;
    }
    setLocalListing(nextListing);
    onUpdate(nextListing);
  };

  const translateMarket = async (marketCode: string, currentListingState?: Listing) => {
    if (marketCode === 'US' || translatingMarkets.has(marketCode)) return;
    const activeState = currentListingState || localListing;
    setTranslatingMarkets(prev => new Set(prev).add(marketCode));
    try {
      const sourceDataForTranslation = activeState.optimized || {
        optimized_title: activeState.cleaned.title,
        optimized_features: (activeState.cleaned.bullet_points || activeState.cleaned.features || []).filter(Boolean),
        optimized_description: activeState.cleaned.description || '',
        search_keywords: activeState.cleaned.search_keywords || ''
      } as OptimizedData;
      
      const targetLang = MARKET_LANG_MAP[marketCode];
      let trans: Partial<OptimizedData> = {};
      const isEnglishMkt = ['UK', 'CA', 'AU', 'SG', 'IE'].includes(marketCode);
      
      if (isEnglishMkt || !targetLang) {
        trans = { ...sourceDataForTranslation };
      } else {
        if (engine === 'openai') trans = await translateListingWithOpenAI(sourceDataForTranslation, targetLang);
        else if (engine === 'deepseek') trans = await translateListingWithDeepSeek(sourceDataForTranslation, targetLang);
        else trans = await translateListingWithAI(sourceDataForTranslation, targetLang);
      }
      
      if (!trans || Object.keys(trans).length === 0) throw new Error("AI engine returned invalid or empty JSON.");

      const rate = exchangeRates.find(r => r.marketplace === marketCode)?.rate || 1;

      // 核心变更：不再混入 sourceDataForTranslation，缺失则为空
      const finalTrans: OptimizedData = {
        optimized_title: trans.optimized_title || "",
        optimized_features: Array.isArray(trans.optimized_features) ? trans.optimized_features : ["", "", "", "", ""],
        optimized_description: trans.optimized_description || "",
        search_keywords: trans.search_keywords || "",
        optimized_price: parseFloat(((activeState.cleaned.price || 0) * rate).toFixed(2)),
        optimized_shipping: parseFloat(((activeState.cleaned.shipping || 0) * rate).toFixed(2)),
        optimized_weight_value: trans.optimized_weight_value || "",
        optimized_weight_unit: getAmazonStandardUnit(trans.optimized_weight_unit, marketCode),
        optimized_length: trans.optimized_length || "",
        optimized_width: trans.optimized_width || "",
        optimized_height: trans.optimized_height || "",
        optimized_size_unit: getAmazonStandardUnit(trans.optimized_size_unit, marketCode)
      };

      const updatedListing = { 
        ...activeState, 
        translations: { ...(activeState.translations || {}), [marketCode]: finalTrans } 
      };

      setLocalListing(updatedListing); 
      onUpdate(updatedListing);
      await syncToSupabase(updatedListing); 
      return updatedListing;
    } catch (e: any) {
      console.error(`Translate Error for ${marketCode}:`, e);
      alert(`Translate ${marketCode} failed: ${e.message || String(e)}`);
      return null;
    } finally {
      setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(marketCode); return n; });
    }
  };

  const handleBatchTranslate = async () => {
    setIsBatchTranslating(true);
    const targetMarkets = AMAZON_MARKETPLACES.filter(m => m.code !== 'US');
    setBatchProgress({ current: 0, total: targetMarkets.length, market: '' });
    let currentListing = { ...localListing };
    for (let i = 0; i < targetMarkets.length; i++) {
      const mkt = targetMarkets[i];
      setBatchProgress({ current: i + 1, total: targetMarkets.length, market: mkt.code });
      const result = await translateMarket(mkt.code, currentListing);
      if (result) currentListing = result;
    }
    setBatchProgress({ current: 0, total: 0, market: '' });
    setIsBatchTranslating(false);
  };

  const handleMarketClick = async (code: string) => {
    setActiveMarket(code);
    if (code !== 'US' && !localListing.translations?.[code] && !translatingMarkets.has(code)) {
      await translateMarket(code);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const sourceData = localListing.cleaned!;
      let opt: OptimizedData;
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(sourceData);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(sourceData);
      else opt = await optimizeListingWithAI(sourceData);
      
      const updatedListing: Listing = { ...localListing, optimized: opt, status: 'optimized', updated_at: new Date().toISOString() };
      setLocalListing(updatedListing); 
      onUpdate(updatedListing); 
      await syncToSupabase(updatedListing);
      setActiveMarket('US'); 
    } catch (e: any) { alert(`Optimization Failed: ${e.message}`); } 
    finally { setIsOptimizing(false); }
  };

  const allImages = [localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])].filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="group flex items-center text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-all">
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> {t('back')}
          </button> 
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
             {['gemini', 'openai', 'deepseek'].map(e => (
               <button key={e} onClick={() => setEngine(e as AIEngine)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${engine === e ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                 {e === 'gemini' ? <Zap size={12}/> : e === 'openai' ? <Brain size={12}/> : <Cpu size={12}/>} {e}
               </button>
             ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all uppercase shadow-sm">
            {isOptimizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} AI Optimize
          </button>
          <div className="flex items-center bg-slate-900 rounded-2xl p-0.5 shadow-xl">
             <button onClick={() => syncToSupabase(localListing)} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-xs text-white hover:bg-black transition-all uppercase tracking-widest">
               {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('save')}
             </button>
             <div className="w-px h-6 bg-white/10 mx-1"></div>
             <button onClick={onNext} className="p-2.5 text-white hover:bg-white/10 rounded-2xl transition-all" title="Next Listing">
                <ChevronRight size={18} />
             </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
                   {isSaving && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>}
                   <img src={previewImage} className="max-w-full max-h-full object-contain transition-transform duration-700 group-hover:scale-110" />
                   <div className="absolute bottom-4 right-4 flex gap-2">
                      <button onClick={() => setShowImageEditor(true)} disabled={isSaving} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all"><Wand2 size={12} /> AI Editor</button>
                   </div>
                </div>
                <div className="flex flex-wrap gap-2 pb-3">
                   {allImages.map((img, i) => (
                     <div key={i} onMouseEnter={() => setPreviewImage(img)} className={`group/thumb relative w-16 h-16 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden transition-all ${previewImage === img ? 'border-indigo-500 shadow-lg' : 'border-transparent opacity-60'}`}>
                        <img src={img} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                           <button onClick={(e) => { e.stopPropagation(); updateField('main_image', img); setPreviewImage(img); }} className="absolute top-1 left-1 p-1 bg-white/20 hover:bg-amber-500 rounded-lg text-white"><Star size={10} fill={img === localListing.cleaned.main_image ? "currentColor" : "none"} /></button>
                           <button onClick={(e) => { e.stopPropagation(); updateField('other_images', (localListing.cleaned.other_images || []).filter(u => u !== img)); }} className="absolute top-1 right-1 p-1 bg-white/20 hover:bg-red-500 rounded-lg text-white"><Trash2 size={10} /></button>
                        </div>
                     </div>
                   ))}
                   <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all shrink-0"><Plus size={20} /></button>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Link2 size={14} className="text-orange-500" /> Sourcing Discovery</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                   {(localListing.sourcing_data || []).map((s, idx) => (
                     <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <img src={s.image} className="w-10 h-10 rounded-lg object-cover" />
                        <div className="flex-1 overflow-hidden">
                           <p className="text-[9px] font-black text-slate-800 truncate">{s.title}</p>
                           <p className="text-[9px] font-bold text-orange-600 uppercase">{s.price}</p>
                        </div>
                        <a href={s.url} target="_blank" className="p-1.5 text-slate-300 hover:text-blue-500"><ExternalLink size={12}/></a>
                     </div>
                   ))}
                   <button onClick={() => setShowSourcingModal(true)} className="w-full py-3 bg-orange-50 text-orange-600 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-100 transition-all"><Search size={14} /> Search 1688</button>
                </div>
             </div>
          </div>

          <div className="lg:col-span-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between gap-6">
                   <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                      <button onClick={() => handleMarketClick('US')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>🇺🇸 Master</button>
                      {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => {
                        const isTranslated = !!localListing.translations?.[m.code];
                        const isTranslating = translatingMarkets.has(m.code);
                        return (
                          <button 
                            key={m.code} 
                            onClick={() => handleMarketClick(m.code)} 
                            className={`
                              px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 flex items-center gap-2 border-2
                              ${activeMarket === m.code ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 
                                isTranslated ? 'bg-white text-indigo-600 border-slate-100' : 
                                'bg-slate-50/50 text-slate-300 border-slate-200 border-dashed opacity-70 hover:opacity-100'
                              }
                            `}
                          >
                            {m.flag} {m.code} {isTranslating && <Loader2 size={10} className="animate-spin" />}
                          </button>
                        );
                      })}
                   </div>
                   <button onClick={handleBatchTranslate} disabled={isBatchTranslating} className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all shadow-sm shrink-0 border border-indigo-100 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                      {isBatchTranslating ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />} 
                      {isBatchTranslating ? `${batchProgress.current}/${batchProgress.total}` : 'Translate All'}
                   </button>
                </div>

                <div className="p-10 space-y-10">
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign size={14} className="text-emerald-500" /> Price ({activeMarket})</label>
                         <input type="number" step="0.01" value={getFieldValue('optimized_price', 'price')} onChange={(e) => updateField('optimized_price', parseFloat(e.target.value))} onBlur={() => syncToSupabase(localListing)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:bg-white transition-colors" />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Shipping</label>
                         <input type="number" step="0.01" value={getFieldValue('optimized_shipping', 'shipping')} onChange={(e) => updateField('optimized_shipping', parseFloat(e.target.value))} onBlur={() => syncToSupabase(localListing)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:bg-white transition-colors" />
                      </div>
                   </div>

                   <EditSection label="Product Title" icon={<ImageIcon size={14}/>} value={getFieldValue('optimized_title', 'title')} onChange={v => updateField('optimized_title', v)} onBlur={() => syncToSupabase(localListing)} limit={200} className="text-xl font-black" />

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Key Features (Bullets)</label>
                      <div className="space-y-3">
                         {(getFieldValue('optimized_features', 'features') as string[]).map((f: string, i: number) => (
                           <div key={i} className="flex gap-4 group">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-2 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</div>
                              <textarea value={f || ''} onChange={e => { const cur = [...(getFieldValue('optimized_features', 'features') as string[])]; cur[i] = e.target.value; updateField('optimized_features', cur); }} onBlur={() => syncToSupabase(localListing)} className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold leading-relaxed outline-none transition-all focus:bg-white" placeholder={`Bullet Point ${i+1}...`} />
                           </div>
                         ))}
                      </div>
                   </div>

                   <EditSection label="Description (HTML)" icon={<FileText size={14}/>} value={getFieldValue('optimized_description', 'description')} onChange={v => updateField('optimized_description', v)} onBlur={() => syncToSupabase(localListing)} limit={2000} isMono className="min-h-[250px] text-xs" />
                   <EditSection label="Search Keywords" icon={<Hash size={14}/>} value={getFieldValue('search_keywords', 'search_keywords')} onChange={v => updateField('search_keywords', v)} onBlur={() => syncToSupabase(localListing)} limit={250} className="bg-amber-50/20 border-amber-100 text-sm font-bold" />
                </div>
             </div>
          </div>
        </div>
      </div>

      {showSourcingModal && <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={res => { const next = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] }; setLocalListing(next); onUpdate(next); syncToSupabase(next); setShowSourcingModal(false); }} />}
      {showImageEditor && <ImageEditor imageUrl={previewImage} onClose={() => setShowImageEditor(false)} onSave={url => { updateField('main_image', url); setPreviewImage(url); syncToSupabase(localListing); setShowImageEditor(false); }} uiLang={uiLang} />}
    </div>
  );
};

const EditSection = ({ label, icon, value, onChange, onBlur, limit, isMono, className }: any) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between ml-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">{icon} {label}</label>
      {limit && <span className={`text-[9px] font-black uppercase ${(value || '').length > limit ? 'text-red-500' : 'text-slate-400'}`}>{(value || '').length} / {limit}</span>}
    </div>
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} onBlur={onBlur} className={`w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold outline-none transition-all focus:bg-white ${isMono ? 'font-mono' : ''} ${className}`} />
  </div>
);
