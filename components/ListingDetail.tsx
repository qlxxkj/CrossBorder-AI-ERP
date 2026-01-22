
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  Globe, Languages, Loader2, DollarSign, Truck, Save, ChevronRight,
  Zap, Check, Weight, Ruler, ListFilter, FileText, Wand2, Search, 
  ExternalLink, Link2, Star, Maximize2, Hash, Cpu, Brain, Box
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
type DetailSubView = 'editor' | 'sourcing';

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

const METRIC_MARKETS = ['DE', 'FR', 'IT', 'ES', 'JP', 'UK', 'CA', 'MX', 'PL', 'NL', 'SE', 'BE', 'SG', 'AU', 'EG'];

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [activeSubView, setActiveSubView] = useState<DetailSubView>('editor');
  const lastListingId = useRef(listing.id);
  
  const [engine, setEngine] = useState<AIEngine>(() => {
    const saved = localStorage.getItem('amzbot_preferred_engine');
    return (saved as AIEngine) || 'gemini';
  });

  useEffect(() => {
    localStorage.setItem('amzbot_preferred_engine', engine);
  }, [engine]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [translatingMarkets, setTranslatingMarkets] = useState<Set<string>>(new Set());
  const [isStandardizing, setIsStandardizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState<{show: boolean, data: SourcingRecord | null}>({show: false, data: null});
  
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [previewImage, setPreviewImage] = useState<string>(listing.cleaned?.main_image || '');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    if (lastListingId.current !== listing.id) {
      setActiveMarket('US');
      setActiveSubView('editor');
      lastListingId.current = listing.id;
    }
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
      // sync complete
    } catch (e: any) { console.error("Auto-save failed:", e); } 
    finally { setIsSaving(false); }
  };

  const uploadImageToHost = async (dataUrlOrFile: string | File, asin: string): Promise<string> => {
    let file: File;
    if (typeof dataUrlOrFile === 'string') {
      const res = await fetch(dataUrlOrFile);
      const blob = await res.blob();
      file = new File([blob], `${asin}_${Date.now()}.jpg`, { type: 'image/jpeg' });
    } else {
      file = dataUrlOrFile;
    }
    const formDataBody = new FormData();
    formDataBody.append('file', file);
    const response = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formDataBody });
    if (!response.ok) throw new Error("Image hosting failed");
    const data = await response.json();
    return Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
  };

  /**
   * CORE FIX: 优先级重构
   * 1. 如果是目标站点翻译，优先看翻译块。
   * 2. 如果是 US 站点，优先看优化块 (optimized)。
   * 3. 兜底看原始采集块 (cleaned)。
   */
  const getFieldValue = (optField: string, cleanField: string) => {
    const getBestValue = () => {
      // 如果是目标站点，优先查看翻译
      if (activeMarket !== 'US') {
        const trans = localListing.translations?.[activeMarket];
        if (trans) {
          const val = (trans as any)[optField];
          if (Array.isArray(val)) {
            if (val.length > 0 && val.some(v => v && v.trim() !== '')) return val;
          } else if (val !== undefined && val !== null && String(val).trim() !== '') {
            return val;
          }
        }
      }

      // 查看优化块内容
      const optVal = localListing.optimized ? (localListing.optimized as any)[optField] : null;
      
      // 特殊处理五点描述数组
      if (optField.includes('features')) {
        if (Array.isArray(optVal) && optVal.length > 0 && optVal.some(v => v && v.trim() !== '')) {
          return optVal;
        }
        // 如果优化块没有五点，回退到采集块
        const cleanedFeatures = localListing.cleaned.features;
        if (Array.isArray(cleanedFeatures) && cleanedFeatures.length > 0) return cleanedFeatures;
        return ['', '', '', '', ''];
      }

      // 处理其他字符串字段
      if (optVal !== undefined && optVal !== null && typeof optVal === 'string' && optVal.trim() !== '') {
        return optVal;
      }
      
      // 最终回退到原始采集数据
      const cleanVal = (localListing.cleaned as any)[cleanField];
      if (cleanVal !== undefined && cleanVal !== null && String(cleanVal).trim() !== '') return cleanVal;
      
      return optField.includes('features') ? ['', '', '', '', ''] : '';
    };

    const value = getBestValue();

    // 价格和运费的特殊自动换算逻辑
    if (activeMarket !== 'US' && (optField === 'optimized_price' || optField === 'optimized_shipping')) {
      const sourceVal = localListing.cleaned[cleanField] || 0;
      const rate = exchangeRates.find(r => r.marketplace === activeMarket)?.rate || 1;
      const converted = sourceVal * rate;
      return activeMarket === 'JP' ? Math.round(converted) : parseFloat(converted.toFixed(2));
    }

    return value;
  };

  const updateField = (field: string, value: any) => {
    const nextListing = { ...localListing };
    if (activeMarket === 'US') {
      const cleanKey = field.startsWith('optimized_') ? field.replace('optimized_', '') : field;
      // 总是保持 optimized 块存在，以便 getFieldValue 优先识别
      nextListing.optimized = { ...(nextListing.optimized || {}), [field]: value } as OptimizedData;
      // 同步更新 cleaned 块，防止丢失数据
      if (nextListing.cleaned.hasOwnProperty(cleanKey)) {
        nextListing.cleaned = { ...nextListing.cleaned, [cleanKey]: value };
      }
    } else {
      const currentTranslations = { ...(nextListing.translations || {}) };
      const currentTrans = currentTranslations[activeMarket] || { 
        optimized_title: '', 
        optimized_features: ['', '', '', '', ''], 
        optimized_description: '', 
        search_keywords: '' 
      } as OptimizedData;
      currentTranslations[activeMarket] = { ...currentTrans, [field]: value };
      nextListing.translations = currentTranslations;
    }
    setLocalListing(nextListing);
    onUpdate(nextListing); // 通知父组件
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(localListing.cleaned!);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(localListing.cleaned!);
      else opt = await optimizeListingWithAI(localListing.cleaned!);
      
      const updated: Listing = { ...localListing, status: 'optimized', optimized: opt };
      
      // 先更新本地状态，确保 UI 立即响应
      setLocalListing(updated);
      onUpdate(updated); 
      
      // 异步持久化
      await syncToSupabase(updated); 
    } catch (e: any) { alert(`AI Optimization failed: ` + e.message); } 
    finally { setIsOptimizing(false); }
  };

  const translateMarket = async (marketCode: string) => {
    if (marketCode === 'US') return;
    setTranslatingMarkets(prev => new Set(prev).add(marketCode));
    try {
        const sourceData = localListing.optimized || {
            optimized_title: localListing.cleaned.title,
            optimized_features: localListing.cleaned.features || [],
            optimized_description: localListing.cleaned.description || '',
            search_keywords: localListing.cleaned.search_keywords || '',
            optimized_weight_unit: localListing.cleaned.item_weight_unit || 'Pounds',
            optimized_size_unit: localListing.cleaned.item_size_unit || 'Inches'
        } as OptimizedData;
        
        let trans: Partial<OptimizedData>;
        if (engine === 'openai') trans = await translateListingWithOpenAI(sourceData, marketCode);
        else if (engine === 'deepseek') trans = await translateListingWithDeepSeek(sourceData, marketCode);
        else trans = await translateListingWithAI(sourceData, marketCode);
        
        const rate = exchangeRates.find(r => r.marketplace === marketCode)?.rate || 1;
        const isMetric = METRIC_MARKETS.includes(marketCode);
        const rawWeight = parseFloat(localListing.optimized?.optimized_weight_value || localListing.cleaned.item_weight_value || '0');
        const rawL = parseFloat(localListing.optimized?.optimized_length || localListing.cleaned.item_length || '0');
        const rawW = parseFloat(localListing.optimized?.optimized_width || localListing.cleaned.item_width || '0');
        const rawH = parseFloat(localListing.optimized?.optimized_height || localListing.cleaned.item_height || '0');

        const getFallbackUnit = (mkt: string, type: 'weight' | 'size') => {
          if (mkt === 'JP') return type === 'weight' ? 'キログラム' : 'センチメートル';
          return METRIC_MARKETS.includes(mkt) ? (type === 'weight' ? 'Kilograms' : 'Centimeters') : (type === 'weight' ? 'Pounds' : 'Inches');
        };

        const updatedTrans = {
          ...trans,
          optimized_price: parseFloat(((localListing.cleaned.price || 0) * rate).toFixed(2)),
          optimized_shipping: parseFloat(((localListing.cleaned.shipping || 0) * rate).toFixed(2)),
          optimized_weight_value: isMetric ? (rawWeight * 0.45359).toFixed(2) : rawWeight.toFixed(2),
          optimized_weight_unit: trans.optimized_weight_unit || getFallbackUnit(marketCode, 'weight'),
          optimized_length: isMetric ? (rawL * 2.54).toFixed(2) : rawL.toFixed(2),
          optimized_width: isMetric ? (rawW * 2.54).toFixed(2) : rawW.toFixed(2),
          optimized_height: isMetric ? (rawH * 2.54).toFixed(2) : rawH.toFixed(2),
          optimized_size_unit: trans.optimized_size_unit || getFallbackUnit(marketCode, 'size'),
        } as OptimizedData;

        setLocalListing(prev => {
          const next = { ...prev };
          next.translations = { ...(next.translations || {}), [marketCode]: updatedTrans };
          onUpdate(next);
          return next;
        });

        await supabase.from('listings').update({
           translations: { ...(localListing.translations || {}), [marketCode]: updatedTrans }
        }).eq('id', localListing.id);

    } catch (e) {
        console.error(`Translation failed for ${marketCode}`, e);
    } finally {
        setTranslatingMarkets(prev => {
            const next = new Set(prev);
            next.delete(marketCode);
            return next;
        });
    }
  };

  const handleTabClick = (code: string) => {
    setActiveMarket(code);
    if (code !== 'US' && !localListing.translations?.[code] && !translatingMarkets.has(code)) {
        translateMarket(code);
    }
  };

  const allImages = [localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])].filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-inter overflow-hidden">
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="group flex items-center text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-all">
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> {t('back')}
          </button> 
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
             <EngineBtn active={engine === 'gemini'} onClick={() => setEngine('gemini')} icon={<Zap size={14}/>} label="Gemini 3" />
             <EngineBtn active={engine === 'openai'} onClick={() => setEngine('openai')} icon={<Brain size={14}/>} label="GPT-4o" />
             <EngineBtn active={engine === 'deepseek'} onClick={() => setEngine('deepseek')} icon={<Cpu size={14}/>} label="DeepSeek" />
          </div>
        </div>
        
        <div className="flex gap-3">
          {isSaving && <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase animate-pulse"><Loader2 className="animate-spin" size={12} /> Syncing</div>}
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all uppercase shadow-sm">
            {isOptimizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} AI Optimize
          </button>
          <button onClick={() => syncToSupabase(localListing)} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-xs text-white bg-slate-900 hover:bg-black shadow-xl active:scale-95 transition-all uppercase tracking-widest">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('save')}
          </button>
          <button onClick={onNext} className="p-2.5 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-all border border-slate-200">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
                   <img src={previewImage} className="max-w-full max-h-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-110" />
                   <div className="absolute bottom-4 right-4 flex gap-2">
                      <button onClick={() => setShowImageEditor(true)} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all">
                         <Wand2 size={12} /> AI Editor
                      </button>
                   </div>
                </div>
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-3">
                   {allImages.map((img, i) => (
                     <div key={i} onMouseEnter={() => setPreviewImage(img)} className={`group/thumb relative w-16 h-16 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden transition-all ${previewImage === img ? 'border-indigo-500 shadow-lg' : 'border-transparent opacity-60'}`}>
                        <img src={img} className="w-full h-full object-cover" />
                     </div>
                   ))}
                   <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all shrink-0">
                      <Plus size={20} />
                   </button>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sourcing Overview</h3>
                  <button onClick={() => setActiveSubView('sourcing')} className="text-[9px] font-black text-indigo-600 uppercase hover:underline">View All</button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                    <Link2 size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{(localListing.sourcing_data || []).length} Records</p>
                    <p className="text-[10px] font-bold text-slate-400">Attached wholesale links</p>
                  </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-4">
                      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-inner">
                        <button onClick={() => setActiveSubView('editor')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeSubView === 'editor' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Edit2 size={12} /> {t('listings')}
                        </button>
                        <button onClick={() => setActiveSubView('sourcing')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeSubView === 'sourcing' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Search size={12} /> {t('sourcing')}
                        </button>
                      </div>
                   </div>
                   {activeSubView === 'editor' && (
                     <div className="flex items-center gap-3">
                        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto custom-scrollbar no-scrollbar max-w-[400px]">
                            <button onClick={() => handleTabClick('US')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 flex items-center gap-2 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>🇺🇸 Master</button>
                            {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => {
                              const hasTrans = !!localListing.translations?.[m.code];
                              const isTranslating = translatingMarkets.has(m.code);
                              return (
                                <button 
                                  key={m.code} 
                                  onClick={() => handleTabClick(m.code)} 
                                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 border relative flex items-center gap-2 ${
                                    activeMarket === m.code 
                                      ? 'bg-indigo-600 text-white shadow-lg border-indigo-600' 
                                      : hasTrans 
                                        ? 'text-slate-400 hover:text-slate-600 border-transparent' 
                                        : 'text-slate-300 hover:text-slate-500 border-dashed border-slate-200'
                                  }`}
                                >
                                  {m.flag} {m.code}
                                  {isTranslating && <Loader2 size={10} className="animate-spin text-white/70" />}
                                </button>
                              );
                            })}
                        </div>
                     </div>
                   )}
                </div>

                <div className="p-10">
                   {activeSubView === 'editor' ? (
                     <div className="space-y-10">
                        <div className="grid grid-cols-2 gap-8 items-end">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign size={14} className="text-emerald-500" /> Price ({activeMarket})</label>
                              <input 
                                type="number" step="0.01" 
                                value={getFieldValue('optimized_price', 'price')}
                                onChange={(e) => updateField('optimized_price', parseFloat(e.target.value))}
                                onBlur={() => syncToSupabase(localListing)}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl focus:bg-white focus:border-emerald-500 outline-none transition-all" 
                              />
                           </div>
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Shipping Cost</label>
                              <input 
                                type="number" step="0.01" 
                                value={getFieldValue('optimized_shipping', 'shipping')}
                                onChange={(e) => updateField('optimized_shipping', parseFloat(e.target.value))}
                                onBlur={() => syncToSupabase(localListing)}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl focus:bg-white focus:border-blue-500 outline-none transition-all" 
                              />
                           </div>
                        </div>

                        <EditSection 
                         label="Product Title" icon={<ImageIcon size={14}/>} 
                         value={getFieldValue('optimized_title', 'title')}
                         onChange={v => updateField('optimized_title', v)}
                         onBlur={() => syncToSupabase(localListing)}
                         limit={200} className="text-xl font-black leading-snug"
                        />

                        <div className="space-y-4">
                           <div className="flex items-center justify-between ml-1">
                              <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Key Features (Bullets)</label>
                           </div>
                           <div className="space-y-3">
                              {(getFieldValue('optimized_features', 'features') as string[]).map((f: string, i: number) => (
                                <div key={i} className="flex gap-4 group">
                                   <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-2 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</div>
                                   <div className="flex-1 space-y-1">
                                      <textarea 
                                        value={f || ''}
                                        onChange={(e) => {
                                          const current = [...(getFieldValue('optimized_features', 'features') as string[])];
                                          current[i] = e.target.value;
                                          updateField('optimized_features', current);
                                        }}
                                        onBlur={() => syncToSupabase(localListing)}
                                        className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold leading-relaxed focus:bg-white outline-none transition-all border-slate-200 focus:border-indigo-500`}
                                        placeholder={`Bullet Point ${i+1}...`}
                                      />
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>

                        <EditSection 
                         label="Product Description (HTML)" icon={<FileText size={14}/>} 
                         value={getFieldValue('optimized_description', 'description')}
                         onChange={v => updateField('optimized_description', v)}
                         onBlur={() => syncToSupabase(localListing)}
                         limit={2000} isMono className="min-h-[250px] text-xs leading-loose"
                        />

                        <EditSection 
                         label="Search Keywords" icon={<Hash size={14}/>} 
                         value={getFieldValue('search_keywords', 'search_keywords')}
                         onChange={v => updateField('search_keywords', v)}
                         onBlur={() => syncToSupabase(localListing)}
                         limit={250} className="bg-amber-50/20 border-amber-100 focus:border-amber-400 text-sm font-bold"
                        />
                     </div>
                   ) : (
                     <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Sourcing view implementation remains the same */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-orange-50/50 p-10 rounded-[2.5rem] border border-orange-100">
                           <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-orange-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl"><Link2 size={32} /></div>
                              <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Supply Chain Discovery</h3>
                                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Connect with Source Manufacturers</p>
                              </div>
                           </div>
                           <div className="flex gap-3">
                              <button onClick={() => setShowSourcingModal(true)} className="flex items-center gap-2 px-8 py-3.5 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-orange-700 transition-all active:scale-95"><Search size={16} /> AI Visual Search</button>
                              <button onClick={() => setShowSourcingForm({show: true, data: null})} className="flex items-center gap-2 px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"><Plus size={16} /> Manual Link</button>
                           </div>
                        </div>
                        {/* List Sourcing data... */}
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>

      {showSourcingForm.show && (
        <SourcingFormModal 
          initialData={showSourcingForm.data} 
          onClose={() => setShowSourcingForm({show: false, data: null})} 
          onSave={(res) => {
            const nextData = [...(localListing.sourcing_data || [])];
            const existingIdx = nextData.findIndex(s => s.id === res.id);
            if (existingIdx >= 0) nextData[existingIdx] = res;
            else nextData.push(res);
            const next = { ...localListing, sourcing_data: nextData };
            setLocalListing(next); onUpdate(next); syncToSupabase(next); setShowSourcingForm({show: false, data: null});
          }} 
        />
      )}

      {showSourcingModal && (
        <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={(res) => {
            const next = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] };
            setLocalListing(next); onUpdate(next); syncToSupabase(next); setShowSourcingModal(false);
          }}
        />
      )}

      {showImageEditor && <ImageEditor imageUrl={previewImage} onClose={() => setShowImageEditor(false)} onSave={() => {}} uiLang={uiLang} />}
    </div>
  );
};

const EngineBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon} {label}
  </button>
);

const EditSection = ({ label, icon, value, onChange, onBlur, limit, isMono, className }: any) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between ml-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        {icon} {label}
      </label>
      {limit && (
        <span className={`text-[9px] font-black uppercase ${(value || '').length > limit ? 'text-red-500' : 'text-slate-400'}`}>
          {(value || '').length} / {limit}
        </span>
      )}
    </div>
    <textarea 
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`w-full p-6 bg-slate-50 border rounded-[2rem] font-bold outline-none transition-all focus:bg-white ${isMono ? 'font-mono' : ''} ${(value || '').length > (limit || 99999) ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200 focus:border-indigo-500'} ${className}`}
    />
  </div>
);
