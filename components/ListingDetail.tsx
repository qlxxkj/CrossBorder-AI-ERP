
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  Globe, Languages, Loader2, DollarSign, Truck, Save, ChevronRight,
  Zap, Check, Weight, Ruler, ListFilter, FileText, Wand2, Search, 
  ExternalLink, Link2, Star, Maximize2, Hash, Cpu, Brain, AlertTriangle, Upload, Box
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
const CORS_PROXY = 'https://corsproxy.io/?';

// Marketplace standards for units
const METRIC_MARKETS = ['DE', 'FR', 'IT', 'ES', 'JP', 'NL', 'PL', 'SE', 'BE'];

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  
  const [engine, setEngine] = useState<AIEngine>(() => {
    const saved = localStorage.getItem('amzbot_preferred_engine');
    return (saved as AIEngine) || 'gemini';
  });

  useEffect(() => {
    localStorage.setItem('amzbot_preferred_engine', engine);
  }, [engine]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [isStandardizing, setIsStandardizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState<{show: boolean, data: SourcingRecord | null}>({show: false, data: null});
  
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [previewImage, setPreviewImage] = useState<string>(listing.cleaned?.main_image || '');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    setLocalListing(listing);
    setPreviewImage(listing.cleaned?.main_image || '');
    setActiveMarket('US');
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
      onUpdate({ ...targetListing, updated_at: new Date().toISOString() });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e: any) { console.error("Save failed:", e); } 
    finally { setIsSaving(false); }
  };

  // Helper: Correct source selection with regional fallback for units
  const getFieldValue = (optField: string, cleanField: string) => {
    const isMetric = METRIC_MARKETS.includes(activeMarket);
    
    const getDefaultUnit = (field: string) => {
      if (field.includes('weight')) return isMetric ? 'kg' : 'lb';
      if (field.includes('size') || field.includes('unit')) return isMetric ? 'cm' : 'in';
      return '';
    };

    if (activeMarket === 'US') {
      const optVal = localListing.optimized ? (localListing.optimized as any)[optField] : null;
      if (optVal !== undefined && optVal !== null && (Array.isArray(optVal) ? optVal.length > 0 : optVal !== '')) {
        return optVal;
      }
      
      const cleanVal = (localListing.cleaned as any)[cleanField];
      if (cleanVal !== undefined && cleanVal !== null) return cleanVal;

      // Type-specific defaults for US
      if (optField.includes('unit')) return getDefaultUnit(optField);
      if (optField.includes('features')) return ['', '', '', '', ''];
      return '';
    }

    // Check existing translation (Important for non-US markets)
    const trans = localListing.translations?.[activeMarket];
    if (trans && (trans as any)[optField] !== undefined && (trans as any)[optField] !== null) {
      const val = (trans as any)[optField];
      // Only return if it's not an empty string or empty array (except for units which we handle below)
      if (Array.isArray(val) ? val.length > 0 : val !== '') {
        return val;
      }
    }

    // Dynamic fallbacks for Non-US prices
    if (optField === 'optimized_price' || optField === 'optimized_shipping') {
      const sourceVal = localListing.cleaned[cleanField] || 0;
      const rate = exchangeRates.find(r => r.marketplace === activeMarket)?.rate || 1;
      const converted = sourceVal * rate;
      return activeMarket === 'JP' ? Math.round(converted) : parseFloat(converted.toFixed(2));
    }

    // Fallback for units if not found in translations
    if (optField.includes('unit')) return getDefaultUnit(optField);
    
    // Always ensure features returns an array for mapping
    if (optField.includes('features')) return ['', '', '', '', ''];

    return '';
  };

  const updateField = (field: string, value: any) => {
    const nextListing = { ...localListing };
    
    if (activeMarket === 'US') {
      if (nextListing.status === 'optimized' && nextListing.optimized) {
        nextListing.optimized = { ...nextListing.optimized, [field]: value };
      } else {
        const cleanKey = field.startsWith('optimized_') ? field.replace('optimized_', '') : field;
        nextListing.cleaned = { ...nextListing.cleaned, [cleanKey]: value };
      }
    } else {
      const currentTranslations = { ...(nextListing.translations || {}) };
      const currentTrans = currentTranslations[activeMarket] || { optimized_title: '', optimized_features: ['', '', '', '', ''], optimized_description: '', search_keywords: '' } as OptimizedData;
      currentTranslations[activeMarket] = { ...currentTrans, [field]: value };
      nextListing.translations = currentTranslations;
    }
    setLocalListing(nextListing);
  };

  const handleBatchStandardize = async () => {
    setIsStandardizing(true);
    try {
      const nextListing = { ...localListing };
      const allImgs = [nextListing.cleaned.main_image, ...(nextListing.cleaned.other_images || [])].filter(Boolean) as string[];
      const processed: string[] = [];

      const processImage = async (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = `${CORS_PROXY}${encodeURIComponent(url)}`;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1600; canvas.height = 1600;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("Canvas failure");
            ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 1600, 1600);
            const scale = Math.min(1500 / img.width, 1500 / img.height);
            const w = img.width * scale; const h = img.height * scale;
            ctx.drawImage(img, (1600 - w) / 2, (1600 - h) / 2, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
          };
          img.onerror = () => reject("Image load error");
        });
      };

      for (const url of allImgs) {
        const newUrl = await processImage(url);
        processed.push(newUrl);
      }

      nextListing.cleaned.main_image = processed[0];
      nextListing.cleaned.other_images = processed.slice(1);
      setLocalListing(nextListing);
      setPreviewImage(processed[0]);
      await syncToSupabase(nextListing);
    } catch (e) { alert("Standardize failed: " + e); } 
    finally { setIsStandardizing(false); }
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      const formDataBody = new FormData();
      formDataBody.append('file', file);
      const response = await fetch(`${CORS_PROXY}${encodeURIComponent(IMAGE_HOST_DOMAIN + '/upload')}`, { method: 'POST', body: formDataBody });
      const data = await response.json();
      const url = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
      const nextListing = { ...localListing };
      nextListing.cleaned.other_images = [...(nextListing.cleaned.other_images || []), url];
      setLocalListing(nextListing);
      await syncToSupabase(nextListing);
    } catch (err) { alert("Upload failed"); } 
    finally { setIsSaving(false); }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(localListing.cleaned!);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(localListing.cleaned!);
      else opt = await optimizeListingWithAI(localListing.cleaned!);
      const updated: Listing = { ...localListing, status: 'optimized', optimized: opt };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (e: any) { alert(`AI Optimization failed: ` + e.message); } 
    finally { setIsOptimizing(false); }
  };

  const handleBatchTranslate = async () => {
    setIsBatchTranslating(true);
    const nextListing = { ...localListing };
    const currentTranslations = { ...(nextListing.translations || {}) };
    for (const mkt of AMAZON_MARKETPLACES) {
      if (mkt.code === 'US') continue;
      try {
        const sourceData = localListing.optimized || {
          optimized_title: localListing.cleaned.title,
          optimized_features: localListing.cleaned.features || [],
          optimized_description: localListing.cleaned.description || '',
          search_keywords: localListing.cleaned.search_keywords || ''
        } as OptimizedData;
        
        let trans: Partial<OptimizedData>;
        if (engine === 'openai') trans = await translateListingWithOpenAI(sourceData, mkt.code);
        else if (engine === 'deepseek') trans = await translateListingWithDeepSeek(sourceData, mkt.code);
        else trans = await translateListingWithAI(sourceData, mkt.code);
        
        const rate = exchangeRates.find(r => r.marketplace === mkt.code)?.rate || 1;
        const isMetric = METRIC_MARKETS.includes(mkt.code);
        
        currentTranslations[mkt.code] = {
          ...trans,
          optimized_price: parseFloat(((localListing.cleaned.price || 0) * rate).toFixed(2)),
          optimized_shipping: parseFloat(((localListing.cleaned.shipping || 0) * rate).toFixed(2)),
          optimized_weight_value: isMetric ? (parseFloat(localListing.cleaned.item_weight_value || '0') * 0.45359).toFixed(2) : localListing.cleaned.item_weight_value,
          optimized_weight_unit: isMetric ? 'kg' : 'lb',
          optimized_length: isMetric ? (parseFloat(localListing.cleaned.item_length || '0') * 2.54).toFixed(2) : localListing.cleaned.item_length,
          optimized_width: isMetric ? (parseFloat(localListing.cleaned.item_width || '0') * 2.54).toFixed(2) : localListing.cleaned.item_width,
          optimized_height: isMetric ? (parseFloat(localListing.cleaned.item_height || '0') * 2.54).toFixed(2) : localListing.cleaned.item_height,
          optimized_size_unit: isMetric ? 'cm' : 'in',
        } as OptimizedData;
      } catch (e) {}
    }
    nextListing.translations = currentTranslations;
    setLocalListing(nextListing);
    await syncToSupabase(nextListing);
    setIsBatchTranslating(false);
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
          <div className="lg:col-span-4 space-y-6 sticky top-0">
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
                   <img src={previewImage} className="max-w-full max-h-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-110" />
                   <div className="absolute bottom-4 right-4 flex gap-2">
                      <button onClick={handleBatchStandardize} disabled={isStandardizing} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all">
                        {isStandardizing ? <Loader2 className="animate-spin" size={12} /> : <Box size={12} />} 1600 Standard
                      </button>
                      <button onClick={() => setShowImageEditor(true)} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all">
                         <Wand2 size={12} /> AI Editor
                      </button>
                   </div>
                </div>
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-3">
                   {allImages.map((img, i) => (
                     <div key={i} onMouseEnter={() => setPreviewImage(img)} className={`group/thumb relative w-16 h-16 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden transition-all ${previewImage === img ? 'border-indigo-500 shadow-lg' : 'border-transparent opacity-60'}`}>
                        <img src={img} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                           <button onClick={(e) => { e.stopPropagation(); updateField('main_image', img); setPreviewImage(img); }} className="p-1 text-white hover:text-amber-400" title="Set as Main"><Star size={12} fill={img === localListing.cleaned.main_image ? "currentColor" : "none"} /></button>
                           <button onClick={(e) => { e.stopPropagation(); const others = (localListing.cleaned.other_images || []).filter(u => u !== img); updateField('other_images', others); }} className="p-1 text-white hover:text-red-400" title="Delete"><Trash2 size={12} /></button>
                        </div>
                     </div>
                   ))}
                   <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all shrink-0">
                      <Plus size={20} />
                   </button>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAddImage} />
                </div>
             </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto custom-scrollbar no-scrollbar">
                      <button onClick={() => setActiveMarket('US')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>🇺🇸 US Master</button>
                      {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => (
                        <button key={m.code} onClick={() => setActiveMarket(m.code)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === m.code ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{m.flag} {m.code}</button>
                      ))}
                   </div>
                   <button onClick={handleBatchTranslate} disabled={isBatchTranslating} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shrink-0">
                      {isBatchTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} Batch Translate All
                   </button>
                </div>

                <div className="p-10 space-y-10">
                   <div className="grid grid-cols-2 gap-8 items-end">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign size={14} className="text-emerald-500" /> Price ({activeMarket})</label>
                         <input 
                           type="number" step="0.01" 
                           value={getFieldValue('optimized_price', 'price')}
                           onChange={(e) => updateField('optimized_price', parseFloat(e.target.value))}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl focus:bg-white focus:border-emerald-500 outline-none transition-all" 
                         />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Shipping Cost</label>
                         <input 
                           type="number" step="0.01" 
                           value={getFieldValue('optimized_shipping', 'shipping')}
                           onChange={(e) => updateField('optimized_shipping', parseFloat(e.target.value))}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl focus:bg-white focus:border-blue-500 outline-none transition-all" 
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8 items-end">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Weight size={14} className="text-amber-500" /> Weight</label>
                         <div className="flex gap-2">
                           <input type="text" value={getFieldValue('optimized_weight_value', 'item_weight_value')} onChange={e => updateField('optimized_weight_value', e.target.value)} className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" />
                           <select value={getFieldValue('optimized_weight_unit', 'item_weight_unit')} onChange={e => updateField('optimized_weight_unit', e.target.value)} className="w-40 px-2 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                             <option value="lb">lb (Pounds)</option>
                             <option value="kg">kg (Kilograms)</option>
                             <option value="oz">oz (Ounces)</option>
                             <option value="g">g (Grams)</option>
                           </select>
                         </div>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Ruler size={14} className="text-indigo-500" /> Dimensions (L / W / H)</label>
                         <div className="flex gap-2">
                           <div className="grid grid-cols-3 gap-1 flex-1">
                              <input placeholder="L" type="text" value={getFieldValue('optimized_length', 'item_length')} onChange={e => updateField('optimized_length', e.target.value)} className="w-full px-2 py-4 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-xs" />
                              <input placeholder="W" type="text" value={getFieldValue('optimized_width', 'item_width')} onChange={e => updateField('optimized_width', e.target.value)} className="w-full px-2 py-4 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-xs" />
                              <input placeholder="H" type="text" value={getFieldValue('optimized_height', 'item_height')} onChange={e => updateField('optimized_height', e.target.value)} className="w-full px-2 py-4 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-xs" />
                           </div>
                           <select value={getFieldValue('optimized_size_unit', 'item_size_unit')} onChange={e => updateField('optimized_size_unit', e.target.value)} className="w-40 px-2 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase">
                             <option value="in">in (Inches)</option>
                             <option value="cm">cm (Centimeters)</option>
                             <option value="mm">mm (Millimeters)</option>
                           </select>
                         </div>
                      </div>
                   </div>

                   <EditSection 
                    label="Product Title" icon={<ImageIcon size={14}/>} 
                    value={getFieldValue('optimized_title', 'title')}
                    onChange={v => updateField('optimized_title', v)}
                    limit={200} className="text-xl font-black leading-snug"
                   />

                   <div className="space-y-4">
                      <div className="flex items-center justify-between ml-1">
                         <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Key Features (Bullets)</label>
                         <button onClick={() => {
                            const currentFeatures = getFieldValue('optimized_features', 'features');
                            updateField('optimized_features', [...currentFeatures, ""]);
                         }} className="p-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><Plus size={16}/></button>
                      </div>
                      <div className="space-y-3">
                         {getFieldValue('optimized_features', 'features').map((f: string, i: number) => (
                           <div key={i} className="flex gap-4 group">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-2 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</div>
                              <div className="flex-1 space-y-1">
                                 <textarea 
                                   value={f || ''}
                                   onChange={(e) => {
                                     const currentFeatures = [...getFieldValue('optimized_features', 'features')];
                                     currentFeatures[i] = e.target.value;
                                     updateField('optimized_features', currentFeatures);
                                   }}
                                   className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold leading-relaxed focus:bg-white outline-none transition-all border-slate-200 focus:border-indigo-500`}
                                   placeholder={`Bullet Point ${i+1}...`}
                                 />
                                 <div className="flex justify-between items-center px-1">
                                    <span className={`text-[9px] font-black uppercase ${(f || '').length > 500 ? 'text-red-500' : 'text-slate-400'}`}>{(f || '').length} / 500</span>
                                    <button onClick={() => {
                                      const currentFeatures = [...getFieldValue('optimized_features', 'features')].filter((_, idx) => idx !== i);
                                      updateField('optimized_features', currentFeatures);
                                    }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>

                   <EditSection 
                    label="Product Description (HTML)" icon={<FileText size={14}/>} 
                    value={getFieldValue('optimized_description', 'description')}
                    onChange={v => updateField('optimized_description', v)}
                    limit={2000} isMono className="min-h-[250px] text-xs leading-loose"
                   />

                   <EditSection 
                    label="Search Keywords" icon={<Hash size={14}/>} 
                    value={getFieldValue('search_keywords', 'search_keywords')}
                    onChange={v => updateField('search_keywords', v)}
                    limit={250} className="bg-amber-50/20 border-amber-100 focus:border-amber-400 text-sm font-bold"
                   />
                </div>
             </div>

             {/* Sourcing Center */}
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10 space-y-8 mt-8">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-xl"><Link2 size={24} /></div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Supply Chain Discovery</h3>
                        <p className="text-xs text-slate-400 font-bold">Manage wholesale sources and manufacturer benchmarks.</p>
                      </div>
                   </div>
                   <div className="flex gap-3">
                      <button onClick={() => setShowSourcingModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-orange-700 transition-all"><Search size={14} /> AI Visual Search</button>
                      <button onClick={() => setShowSourcingForm({show: true, data: null})} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"><Plus size={14} /> Manual Record</button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {(localListing.sourcing_data || []).map((s, idx) => (
                     <div key={idx} className="group bg-slate-50 border border-slate-100 p-5 rounded-3xl flex items-center gap-5 relative hover:bg-white hover:shadow-2xl hover:border-orange-200 transition-all">
                        <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-slate-200 shrink-0">
                           <img src={s.image} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                           <p className="text-xs font-black text-slate-900 truncate">{s.title}</p>
                           <p className="text-orange-600 font-black text-lg mt-0.5">{s.price}</p>
                           <div className="flex items-center gap-3 mt-2">
                              <a href={s.url} target="_blank" className="inline-flex items-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Supplier <ExternalLink size={10} /></a>
                              <button onClick={() => setShowSourcingForm({show: true, data: s})} className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Edit</button>
                           </div>
                        </div>
                        <button onClick={() => { 
                          const next = { ...localListing, sourcing_data: (localListing.sourcing_data || []).filter((_, i) => i !== idx) }; 
                          setLocalListing(next); syncToSupabase(next); 
                        }} className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                     </div>
                   ))}
                   {(localListing.sourcing_data || []).length === 0 && (
                     <div className="col-span-2 py-16 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center opacity-30"><Link2 size={32} className="mb-3" /><p className="text-[10px] font-black uppercase tracking-widest">No sourcing data attached</p></div>
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
            setLocalListing(next); syncToSupabase(next); setShowSourcingForm({show: false, data: null});
          }} 
        />
      )}

      {showSourcingModal && (
        <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={(res) => {
            const next = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] };
            setLocalListing(next); syncToSupabase(next); setShowSourcingModal(false);
          }}
        />
      )}

      {showImageEditor && <ImageEditor imageUrl={previewImage} onClose={() => setShowImageEditor(false)} onSave={(url) => { updateField('main_image', url); setPreviewImage(url); setShowImageEditor(false); }} uiLang={uiLang} />}
    </div>
  );
};

const EngineBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon} {label}
  </button>
);

const EditSection = ({ label, icon, value, onChange, limit, isMono, className }: any) => (
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
      className={`w-full p-6 bg-slate-50 border rounded-[2rem] font-bold outline-none transition-all focus:bg-white ${isMono ? 'font-mono' : ''} ${(value || '').length > (limit || 99999) ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200 focus:border-indigo-500'} ${className}`}
    />
  </div>
);
