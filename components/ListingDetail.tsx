
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  Globe, Languages, Loader2, DollarSign, Truck, Save, ChevronRight,
  Zap, Weight, Ruler, ListFilter, FileText, Wand2, Search, 
  ExternalLink, Link2, Star, Box, Hash, Cpu, Brain, AlertTriangle, RefreshCw, Scale, Maximize2
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

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

// --- 换算与本地化工具 ---
const getLocalizedUnit = (unit: string | undefined, market: string) => {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  if (market === 'JP') {
    const jpMap: Record<string, string> = { 
      'kg': 'キログラム', 'kilogram': 'キログラム', 'kilograms': 'キログラム',
      'cm': 'センチメートル', 'centimeter': 'センチメートル', 'centimeters': 'センチメートル',
      'lb': 'ポンド', 'pound': 'ポンド', 'pounds': 'ポンド',
      'in': 'インチ', 'inch': 'インチ', 'inches': 'インチ'
    };
    return jpMap[u] || unit;
  }
  if (['MX', 'BR', 'ES'].includes(market)) {
    const latinExtMap: Record<string, string> = {
      'kg': 'Kilogramos', 'kilogram': 'Kilogramos', 'kilograms': 'Kilogramos',
      'cm': 'Centímetros', 'centimeter': 'Centímetros', 'centimeters': 'Centímetros',
      'lb': 'Libras', 'pound': 'Libras', 'pounds': 'Libras',
      'in': 'Pulgadas', 'inch': 'Pulgadas', 'inches': 'Pulgadas'
    };
    return latinExtMap[u] || unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
  }
  if (['EG', 'SA', 'AE'].includes(market)) {
    const arMap: Record<string, string> = { 
      'kg': 'كيلوجرام', 'kilogram': 'كيلوجرام', 'kilograms': 'كيلوجرام',
      'cm': 'سنتيمتر', 'centimeter': 'سنتيمتر', 'centimeters': 'سنتيمتر',
      'lb': 'رطل', 'pound': 'رطل', 'pounds': 'رطل',
      'in': 'بوصة', 'inch': 'بوصة', 'inches': 'بوصة'
    };
    return arMap[u] || unit;
  }
  const latinMap: Record<string, string> = {
    'kg': 'Kilograms', 'kilogram': 'Kilograms', 'kilograms': 'Kilograms',
    'cm': 'Centimeters', 'centimeter': 'Centimeters', 'centimeters': 'Centimeters',
    'lb': 'Pounds', 'pound': 'Pounds', 'pounds': 'Pounds',
    'in': 'Inches', 'inch': 'Inches', 'inches': 'Inches'
  };
  if (latinMap[u]) return latinMap[u];
  return unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
};

const MARKET_LANG_MAP: Record<string, string> = {
  'DE': 'German', 'FR': 'French', 'IT': 'Italian', 'ES': 'Spanish', 
  'JP': 'Japanese', 'PL': 'Polish', 'NL': 'Dutch', 'SE': 'Swedish', 
  'BR': 'Portuguese', 'MX': 'Spanish', 'EG': 'Arabic', 'BE': 'French',
  'TR': 'Turkish', 'SA': 'Arabic', 'AE': 'Arabic'
};

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<AIEngine>(() => (localStorage.getItem('amzbot_preferred_engine') as AIEngine) || 'gemini');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, market: '' });
  const [translatingMarkets, setTranslatingMarkets] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState(false);
  const [editingSourceRecord, setEditingSourceRecord] = useState<SourcingRecord | null>(null);
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
    } catch (e) { console.error("Sync Error:", e); } 
    finally { setIsSaving(false); }
  };

  const updateField = (field: string, value: any) => {
    const nextListing = { ...localListing };
    if (activeMarket === 'US') {
      if (['main_image', 'other_images', 'sourcing_data'].includes(field)) {
        if (field === 'sourcing_data') nextListing.sourcing_data = value;
        else nextListing.cleaned = { ...nextListing.cleaned, [field]: value };
      } else {
        nextListing.optimized = { ...(nextListing.optimized || {}), [field]: value } as OptimizedData;
      }
    } else {
      const currentTranslations = { ...(nextListing.translations || {}) };
      const currentTrans = currentTranslations[activeMarket] || {} as OptimizedData;
      currentTranslations[activeMarket] = { ...currentTrans, [field]: value };
      nextListing.translations = currentTranslations;
    }
    setLocalListing(nextListing);
    onUpdate(nextListing);
  };

  // --- 逻辑换算核心 ---
  const performLogisticsConversion = (source: any, targetMkt: string) => {
    const isMetricTarget = !['US', 'CA', 'UK'].includes(targetMkt);
    const sUnitW = String(source.item_weight_unit || source.optimized_weight_unit || "lb").toLowerCase();
    const sUnitS = String(source.item_size_unit || source.optimized_size_unit || "in").toLowerCase();
    
    let weightVal = source.item_weight_value || source.optimized_weight_value || "";
    let l = source.item_length || source.optimized_length || "";
    let w = source.item_width || source.optimized_width || "";
    let h = source.item_height || source.optimized_height || "";
    
    const num = (v: any) => parseFloat(String(v || "0").replace(/[^0-9.]/g, ''));
    
    if (isMetricTarget) {
      if (sUnitW.includes('lb') || sUnitW.includes('pound')) {
        const n = num(weightVal);
        weightVal = n > 0 ? (n * 0.453592).toFixed(2) : "";
      }
      if (sUnitS.includes('in') || sUnitS.includes('inch')) {
        const nl = num(l), nw = num(w), nh = num(h);
        l = nl > 0 ? (nl * 2.54).toFixed(2) : "";
        w = nw > 0 ? (nw * 2.54).toFixed(2) : "";
        h = nh > 0 ? (nh * 2.54).toFixed(2) : "";
      }
    }

    return {
      optimized_weight_value: weightVal,
      optimized_weight_unit: getLocalizedUnit(isMetricTarget ? 'kg' : 'lb', targetMkt),
      optimized_length: l, optimized_width: w, optimized_height: h,
      optimized_size_unit: getLocalizedUnit(isMetricTarget ? 'cm' : 'in', targetMkt)
    };
  };

  const translateMarket = async (marketCode: string, currentListingState?: Listing) => {
    if (marketCode === 'US' || translatingMarkets.has(marketCode)) return;
    const activeState = currentListingState || localListing;
    setTranslatingMarkets(prev => new Set(prev).add(marketCode));
    try {
      const sourceData = activeState.optimized || {
        optimized_title: activeState.cleaned.title,
        optimized_features: (activeState.cleaned.bullet_points || activeState.cleaned.features || []).filter(Boolean),
        optimized_description: activeState.cleaned.description || '',
        search_keywords: activeState.cleaned.search_keywords || '',
        ...activeState.cleaned
      } as OptimizedData;
      
      const targetLang = MARKET_LANG_MAP[marketCode];
      let trans: Partial<OptimizedData> = {};
      if (['UK', 'CA', 'AU', 'SG', 'IE'].includes(marketCode) || !targetLang) trans = { ...sourceData };
      else {
        if (engine === 'openai') trans = await translateListingWithOpenAI(sourceData, targetLang);
        else if (engine === 'deepseek') trans = await translateListingWithDeepSeek(sourceData, targetLang);
        else trans = await translateListingWithAI(sourceData, targetLang);
      }
      
      const rate = exchangeRates.find(r => r.marketplace === marketCode)?.rate || 1;
      const logistics = performLogisticsConversion(activeState.optimized || activeState.cleaned, marketCode);
      
      const finalTrans: OptimizedData = {
        optimized_title: trans.optimized_title || "",
        optimized_features: Array.isArray(trans.optimized_features) ? trans.optimized_features : ["", "", "", "", ""],
        optimized_description: trans.optimized_description || "",
        search_keywords: trans.search_keywords || "",
        optimized_price: parseFloat(((activeState.cleaned.price || 0) * rate).toFixed(2)),
        optimized_shipping: parseFloat(((activeState.cleaned.shipping || 0) * rate).toFixed(2)),
        ...logistics
      };
      
      const updatedListing = { ...activeState, translations: { ...(activeState.translations || {}), [marketCode]: finalTrans } };
      setLocalListing(updatedListing); onUpdate(updatedListing); await syncToSupabase(updatedListing); return updatedListing;
    } catch (e: any) { alert(`Translate ${marketCode} failed: ${e.message}`); return null; }
    finally { setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(marketCode); return n; }); }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(localListing.cleaned);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(localListing.cleaned);
      else opt = await optimizeListingWithAI(localListing.cleaned);
      const updatedListing: Listing = { ...localListing, optimized: opt, status: 'optimized', updated_at: new Date().toISOString() };
      setLocalListing(updatedListing); onUpdate(updatedListing); await syncToSupabase(updatedListing); setActiveMarket('US'); 
    } catch (e: any) { alert(`Optimize Error: ${e.message}`); } 
    finally { setIsOptimizing(false); }
  };

  const getFieldValue = (optField: string, cleanField: string) => {
    const isUS = activeMarket === 'US';
    const sourceData = isUS ? localListing.optimized : localListing.translations?.[activeMarket];
    if (optField === 'optimized_features') {
      const rawFeats = sourceData ? ((sourceData as any)['optimized_features'] || (sourceData as any)['features'] || (sourceData as any)['bullet_points']) : null;
      let feats: string[] = [];
      if (Array.isArray(rawFeats)) feats = rawFeats.map(f => String(f || "").trim());
      else if (typeof rawFeats === 'string' && rawFeats.trim() !== '') feats = rawFeats.split('\n').map(f => f.trim()).filter(Boolean);
      if (feats.length === 0 && isUS) feats = (localListing.cleaned?.bullet_points || localListing.cleaned?.features || []).filter(Boolean);
      const res = [...feats];
      while (res.length < 5) res.push('');
      return res;
    }
    let val = sourceData ? (sourceData as any)[optField] : null;
    if (!isUS && sourceData) return val || "";
    if (isUS) return val || (localListing.cleaned as any)[cleanField] || "";
    return "";
  };

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
          
          {/* 左侧：图片与搜货 */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ImageSection 
               listing={localListing} 
               previewImage={previewImage} 
               setPreviewImage={setPreviewImage} 
               updateField={updateField} 
               isSaving={isSaving} 
               isProcessing={isProcessingImages} 
               setIsProcessing={setIsProcessingImages}
               syncToSupabase={() => syncToSupabase(localListing)}
               setShowEditor={setShowImageEditor}
               fileInputRef={fileInputRef}
             />
             <SourcingSection 
               listing={localListing} 
               previewImage={previewImage} 
               updateField={updateField} 
               syncToSupabase={() => syncToSupabase(localListing)}
               setShowModal={setShowSourcingModal}
               setShowForm={setShowSourcingForm}
               setEditingRecord={setEditingSourceRecord}
             />
          </div>

          {/* 右侧：主编辑区 */}
          <div className="lg:col-span-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between gap-6">
                   <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                      <button onClick={() => setActiveMarket('US')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>🇺🇸 Master</button>
                      {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => {
                        const trans = localListing.translations?.[m.code];
                        return (
                          <button key={m.code} onClick={async () => { setActiveMarket(m.code); if (!trans) await translateMarket(m.code); }} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 flex items-center gap-2 border-2 ${activeMarket === m.code ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : trans ? 'bg-white text-indigo-600 border-slate-100' : 'bg-slate-50/50 text-slate-300 border-slate-200 border-dashed opacity-70 hover:opacity-100'}`}>
                            {m.flag} {m.code} {translatingMarkets.has(m.code) && <Loader2 size={10} className="animate-spin" />}
                          </button>
                        );
                      })}
                   </div>
                   <button onClick={() => {}} disabled={isBatchTranslating} className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all shadow-sm shrink-0 border border-indigo-100 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
                      <Languages size={16} /> Batch
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

                   {/* 物流规格区 - 完美对齐与换算入口 */}
                   <div className="bg-slate-50/50 px-10 py-8 rounded-[2.5rem] border border-slate-100 space-y-8">
                      <div className="flex items-center justify-between">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Box size={14} /> Logistics Specifications</h3>
                         {activeMarket !== 'US' && (
                           <button onClick={() => { const res = performLogisticsConversion(localListing.optimized || localListing.cleaned, activeMarket); Object.entries(res).forEach(([k, v]) => updateField(k, v)); }} className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 uppercase bg-white px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                             <Scale size={12} /> Auto Recalculate & Translate
                           </button>
                         )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Weight size={14} className="text-indigo-400"/> Item Weight</label>
                            <div className="flex gap-3">
                               <input value={getFieldValue('optimized_weight_value', 'item_weight_value')} onChange={e => updateField('optimized_weight_value', e.target.value)} onBlur={() => syncToSupabase(localListing)} className="flex-1 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none" placeholder="0.00" />
                               {/* 固定宽度 w-32 对齐价格框右侧 */}
                               <input value={getFieldValue('optimized_weight_unit', 'item_weight_unit')} onChange={e => updateField('optimized_weight_unit', e.target.value)} onBlur={() => syncToSupabase(localListing)} className="w-32 px-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-[11px] uppercase text-center focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none" placeholder="Unit" />
                            </div>
                         </div>
                         <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Ruler size={14} className="text-indigo-400"/> Dimensions (L × W × H)</label>
                            <div className="flex gap-2">
                               <input value={getFieldValue('optimized_length', 'item_length')} onChange={e => updateField('optimized_length', e.target.value)} onBlur={() => syncToSupabase(localListing)} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none" placeholder="L" />
                               <input value={getFieldValue('optimized_width', 'item_width')} onChange={e => updateField('optimized_width', e.target.value)} onBlur={() => syncToSupabase(localListing)} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none" placeholder="W" />
                               <input value={getFieldValue('optimized_height', 'item_height')} onChange={e => updateField('optimized_height', e.target.value)} onBlur={() => syncToSupabase(localListing)} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none" placeholder="H" />
                               {/* 固定宽度 w-32 对齐运费框右侧 */}
                               <input value={getFieldValue('optimized_size_unit', 'item_size_unit')} onChange={e => updateField('optimized_size_unit', e.target.value)} onBlur={() => syncToSupabase(localListing)} className="w-32 px-2 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-[11px] uppercase text-center focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none" placeholder="Unit" />
                            </div>
                         </div>
                      </div>
                   </div>

                   <EditSection label="Product Title" icon={<ImageIcon size={14}/>} value={getFieldValue('optimized_title', 'title')} onChange={v => updateField('optimized_title', v)} onBlur={() => syncToSupabase(localListing)} limit={200} className="text-xl font-black" />
                   
                   {/* 五点描述区 */}
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Key Features</label>
                        <button onClick={() => { const cur = [...(getFieldValue('optimized_features', 'features') as string[])]; if (cur.length < 10) { cur.push(''); updateField('optimized_features', cur); } }} className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                          <Plus size={12} /> Add Point
                        </button>
                      </div>
                      <div className="space-y-4">
                         {(getFieldValue('optimized_features', 'features') as string[]).map((f: string, i: number) => (
                           <div key={i} className="flex gap-4 group items-start">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-3 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</div>
                              <div className="flex-1 space-y-1.5">
                                <textarea value={f || ''} maxLength={500} onChange={e => { const cur = [...(getFieldValue('optimized_features', 'features') as string[])]; cur[i] = e.target.value; updateField('optimized_features', cur); }} onBlur={() => syncToSupabase(localListing)} className={`w-full p-4 bg-slate-50 border ${f.length > 450 ? 'border-amber-200' : 'border-slate-200'} rounded-2xl text-sm font-bold leading-relaxed outline-none transition-all focus:bg-white focus:ring-4 focus:ring-indigo-500/5`} placeholder={`Bullet Point ${i+1}...`} rows={2} />
                                <div className="flex justify-between items-center px-1">
                                  <span className={`text-[8px] font-black uppercase ${f.length > 480 ? 'text-red-500' : 'text-slate-400'}`}>{f.length} / 500</span>
                                  {i >= 5 && <button onClick={() => { const cur = (getFieldValue('optimized_features', 'features') as string[]).filter((_, idx) => idx !== i); updateField('optimized_features', cur); }} className="text-[8px] font-black text-red-400 uppercase hover:text-red-600">Remove</button>}
                                </div>
                              </div>
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
      {showSourcingForm && <SourcingFormModal initialData={editingSourceRecord} onClose={() => setShowSourcingForm(false)} onSave={record => { let newData = [...(localListing.sourcing_data || [])]; if (editingSourceRecord) newData = newData.map(s => s.id === record.id ? record : s); else newData.push(record); updateField('sourcing_data', newData); syncToSupabase({...localListing, sourcing_data: newData}); setShowSourcingForm(false); }} />}
      {showImageEditor && <ImageEditor imageUrl={previewImage} onClose={() => setShowImageEditor(false)} onSave={url => { updateField('main_image', url); setPreviewImage(url); syncToSupabase(localListing); setShowImageEditor(false); }} uiLang={uiLang} />}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setIsSaving(true); const fd = new FormData(); fd.append('file', file); const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd }); const data = await res.json(); const url = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url; if (url) { updateField('other_images', [...(localListing.cleaned.other_images || []), url]); setPreviewImage(url); await syncToSupabase(localListing); } setIsSaving(false); }} />
    </div>
  );
};

// --- 子组件拆分 ---

const ImageSection = ({ listing, previewImage, setPreviewImage, updateField, isSaving, isProcessing, setIsProcessing, syncToSupabase, setShowEditor, fileInputRef }: any) => {
  const allImages = [listing.cleaned?.main_image, ...(listing.cleaned?.other_images || [])].filter(Boolean) as string[];

  const standardizeImage = async (url: string) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas error");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `${CORS_PROXY}${encodeURIComponent(url)}`;
      img.onload = () => {
        canvas.width = 1600; canvas.height = 1600;
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1600, 1600);
        const scale = Math.min(1500 / img.width, 1500 / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (1600 - w) / 2, (1600 - h) / 2, w, h);
        canvas.toBlob(async (blob) => {
          if (!blob) return reject("Blob error");
          const fd = new FormData(); fd.append('file', new File([blob], `std_${Date.now()}.jpg`, { type: 'image/jpeg' }));
          const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
          const data = await res.json();
          resolve(Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url);
        }, 'image/jpeg', 0.95);
      };
      img.onerror = () => reject("Load error");
    });
  };

  const handleStdAll = async () => {
    setIsProcessing(true);
    try {
      const newMain = await standardizeImage(listing.cleaned.main_image);
      const newOthers = await Promise.all(listing.cleaned.other_images.map((u: string) => standardizeImage(u)));
      updateField('main_image', newMain); updateField('other_images', newOthers); setPreviewImage(newMain);
    } catch (e) { alert("Failed"); } finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
         {(isSaving || isProcessing) && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>}
         <img src={previewImage} className="max-w-full max-h-full object-contain transition-transform duration-700 group-hover:scale-110" />
         <div className="absolute bottom-4 right-4 flex gap-2">
            <button onClick={handleStdAll} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 hover:bg-indigo-700"><Maximize2 size={12} /> 1600 Std All</button>
            <button onClick={() => setShowEditor(true)} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white"><Wand2 size={12} /> AI Editor</button>
         </div>
      </div>
      <div className="flex flex-wrap gap-2">
         {allImages.map((img, i) => (
           <div key={i} onMouseEnter={() => setPreviewImage(img)} className={`group/thumb relative w-16 h-16 rounded-xl border-2 cursor-pointer overflow-hidden ${previewImage === img ? 'border-indigo-500 shadow-lg' : 'border-transparent opacity-60'}`}>
              <img src={img} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex flex-col justify-between p-1">
                 <div className="flex justify-between w-full">
                    <button onClick={(e) => { e.stopPropagation(); updateField('main_image', img); setPreviewImage(img); }} className="p-1 bg-white/20 hover:bg-amber-500 rounded-lg text-white"><Star size={10} fill={img === listing.cleaned.main_image ? "currentColor" : "none"} /></button>
                    <button onClick={(e) => { e.stopPropagation(); updateField('other_images', listing.cleaned.other_images.filter((u:string) => u !== img)); }} className="p-1 bg-white/20 hover:bg-red-500 rounded-lg text-white"><Trash2 size={10} /></button>
                 </div>
                 <button onClick={async (e) => { e.stopPropagation(); setIsProcessing(true); try { const n = await standardizeImage(img); if (img === listing.cleaned.main_image) { updateField('main_image', n); setPreviewImage(n); } else { updateField('other_images', listing.cleaned.other_images.map((u:string)=> u === img ? n : u)); } } finally { setIsProcessing(false); } }} className="w-full py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase">1600</button>
              </div>
           </div>
         ))}
         <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 shrink-0"><Plus size={20} /></button>
      </div>
    </div>
  );
};

const SourcingSection = ({ listing, previewImage, updateField, setShowModal, setShowForm, setEditingRecord }: any) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Link2 size={14} className="text-orange-500" /> Sourcing Discovery</h3>
      <button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Plus size={16}/></button>
    </div>
    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
       {(listing.sourcing_data || []).map((s: any, idx: number) => (
         <div key={idx} className="group flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 relative">
            <img src={s.image} className="w-10 h-10 rounded-lg object-cover" />
            <div className="flex-1 overflow-hidden">
               <p className="text-[9px] font-black text-slate-800 truncate">{s.title}</p>
               <p className="text-[9px] font-bold text-orange-600 uppercase">{s.price}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={() => { setEditingRecord(s); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit2 size={12}/></button>
               <button onClick={() => updateField('sourcing_data', listing.sourcing_data.filter((_:any, i:number) => i !== idx))} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={12}/></button>
            </div>
            <a href={s.url} target="_blank" className="p-1.5 text-slate-300 hover:text-blue-500"><ExternalLink size={12}/></a>
         </div>
       ))}
       <button onClick={() => setShowModal(true)} className="w-full py-3 bg-orange-50 text-orange-600 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-orange-100 transition-all"><Search size={14} /> Search 1688</button>
    </div>
  </div>
);

const EditSection = ({ label, icon, value, onChange, onBlur, limit, isMono, className }: any) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between ml-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">{icon} {label}</label>
      {limit && <span className={`text-[9px] font-black uppercase ${(value || '').length > limit ? 'text-red-500' : 'text-slate-400'}`}>{(value || '').length} / {limit}</span>}
    </div>
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} onBlur={onBlur} className={`w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold outline-none transition-all focus:bg-white ${isMono ? 'font-mono' : ''} ${className}`} />
  </div>
);
