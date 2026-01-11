
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  BrainCircuit, Globe, Languages, Loader2, DollarSign, Truck, Settings2, ZoomIn, Save, ChevronRight,
  Zap, Check, AlertCircle, Weight, Ruler, Coins
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, PriceAdjustment, ExchangeRate } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from '../services/openaiService';
import { ImageEditor } from './ImageEditor';
import { SourcingModal } from './SourcingModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';

const LIMITS = { TITLE: 200, BULLET: 500, DESCRIPTION: 2000, KEYWORDS: 250 };
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

// 辅助函数：安全地保留2位小数
const formatDecimal = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const num = parseFloat(String(val));
  if (isNaN(num)) return val;
  return Number(num.toFixed(2)).toString();
};

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onNext: () => void;
  uiLang: UILanguage;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [selectedImage, setSelectedImage] = useState<string>(listing.cleaned?.main_image || '');
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSourcingOpen, setIsSourcingOpen] = useState(false);
  const [activeMarketplace, setActiveMarketplace] = useState<string>('US'); 
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    fetchPricingData();
  }, []);

  const fetchPricingData = async () => {
    if (!isSupabaseConfigured()) return;
    const [adjRes, rateRes] = await Promise.all([
      supabase.from('price_adjustments').select('*'),
      supabase.from('exchange_rates').select('*')
    ]);
    if (adjRes.data) setAdjustments(adjRes.data);
    if (rateRes.data) setExchangeRates(rateRes.data);
  };

  const listingRef = useRef<Listing>(localListing);
  useEffect(() => { listingRef.current = localListing; }, [localListing]);

  useEffect(() => {
    setLocalListing(listing);
    setSelectedImage(listing.cleaned?.main_image || '');
    setActiveMarketplace('US');
    setLastSaved(null);
  }, [listing.id]);

  const currentContent = activeMarketplace === 'US' 
    ? (localListing.optimized || null)
    : (localListing.translations?.[activeMarketplace] || null);

  const targetMktConfig = useMemo(() => 
    AMAZON_MARKETPLACES.find(m => m.code === activeMarketplace) || AMAZON_MARKETPLACES[0]
  , [activeMarketplace]);

  const localizedPricing = useMemo(() => {
    const rawPrice = Number(localListing.cleaned.price) || 0;
    const rawShipping = Number(localListing.cleaned.shipping) || 0;
    if (activeMarketplace === 'US') return { price: rawPrice, shipping: rawShipping, currency: '$' };
    const rate = exchangeRates.find(r => r.marketplace === activeMarketplace)?.rate || 1;
    let finalPrice = rawPrice * rate;
    let finalShipping = rawShipping * rate;
    if (activeMarketplace === 'JP') {
      finalPrice = Math.round(finalPrice);
      finalShipping = Math.round(finalShipping);
    } else {
      finalPrice = parseFloat(finalPrice.toFixed(2));
      finalShipping = parseFloat(finalShipping.toFixed(2));
    }
    return { price: finalPrice, shipping: finalShipping, currency: targetMktConfig.currency };
  }, [localListing, activeMarketplace, exchangeRates, targetMktConfig]);

  const syncToSupabase = async (targetListing: Listing) => {
    if (!isSupabaseConfigured()) return;
    setIsSaving(true);
    try {
      const payload = {
        cleaned: targetListing.cleaned,
        optimized: targetListing.optimized || null,
        translations: targetListing.translations || null,
        status: targetListing.status,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('listings').update(payload).eq('id', targetListing.id);
      if (error) throw error;
      onUpdate({ ...targetListing, updated_at: new Date().toISOString() });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e: any) { alert("Save failed: " + e.message); } finally { setIsSaving(false); }
  };

  const handleSaveAndNext = async () => { await syncToSupabase(localListing); onNext(); };

  const uploadToHost = async (source: File | string): Promise<string> => {
    let fileToUpload: File;
    if (typeof source === 'string') {
      const res = await fetch(source);
      const blob = await res.blob();
      fileToUpload = new File([blob], `edited_${Date.now()}.jpg`, { type: 'image/jpeg' });
    } else { fileToUpload = source; }
    const formData = new FormData();
    formData.append('file', fileToUpload);
    const response = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formData });
    const data = await response.json();
    return Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
  };

  const handleFieldChange = (path: string, value: any) => {
    setLocalListing(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let current: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const handleBlur = () => { if (listingRef.current) syncToSupabase(listingRef.current); };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let opt = aiProvider === 'gemini' 
        ? await optimizeListingWithAI(localListing.cleaned!)
        : await optimizeListingWithOpenAI(localListing.cleaned!);
      const updated = { ...localListing, status: 'optimized' as const, optimized: opt };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (e: any) { alert(e.message); } finally { setIsOptimizing(false); }
  };

  const handleTranslate = async (mktCode: string) => {
    if (!localListing.optimized) { alert("Optimize English base first."); return; }
    setIsTranslating(mktCode);
    try {
      const mkt = AMAZON_MARKETPLACES.find(m => m.code === mktCode);
      const translated = aiProvider === 'gemini'
        ? await translateListingWithAI(localListing.optimized, mkt?.name || 'English')
        : await translateListingWithOpenAI(localListing.optimized, mkt?.name || 'English');
      const updated = { ...localListing, translations: { ...(localListing.translations || {}), [mktCode]: translated } };
      setLocalListing(updated);
      await syncToSupabase(updated);
      setActiveMarketplace(mktCode);
    } catch (e: any) { alert(e.message); } finally { setIsTranslating(null); }
  };

  if (!listing || !listing.cleaned) return null;

  // 获取显示的物流属性逻辑：当前站翻译值 -> 美国站优化值 -> 原始采集值
  const displayVal = (field: keyof OptimizedData | string, cleanedField: string) => {
    if (activeMarketplace !== 'US' && localListing.translations?.[activeMarketplace]) {
      const val = (localListing.translations[activeMarketplace] as any)[field];
      if (val) return val;
    }
    if (localListing.optimized) {
      const val = (localListing.optimized as any)[field];
      if (val) return val;
    }
    return (localListing.cleaned as any)[cleanedField] || '';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900 font-inter relative animate-in fade-in duration-500">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
      
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-4 z-40">
        <div className="flex items-center gap-6"><button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-black text-sm uppercase tracking-widest"><ArrowLeft size={18} className="mr-2" /> {t('back')}</button> {lastSaved && <div className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full border border-green-100"><Check size={12} /> Auto-saved @ {lastSaved}</div>}</div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200"><button onClick={() => setAiProvider('gemini')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${aiProvider === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Gemini</button><button onClick={() => setAiProvider('openai')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${aiProvider === 'openai' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>GPT-4o</button></div>
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest">{isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} {t('aiOptimize')}</button>
          <button onClick={handleSaveAndNext} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-all active:scale-95 uppercase tracking-widest">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {t('saveAndNext')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center justify-between text-xs uppercase tracking-widest"><span className="flex items-center gap-2"><ImageIcon size={16} className="text-blue-500" /> Media Gallery</span></h3>
            <div className="relative aspect-square rounded-3xl bg-slate-50 border border-slate-100 overflow-hidden mb-6 shadow-inner"><img src={selectedImage} className="w-full h-full object-contain" alt="Main" /></div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 text-xs uppercase tracking-widest"><Languages size={16} className="text-purple-500" /> All Global Sites</h3>
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {AMAZON_MARKETPLACES.map(m => (
                <button key={m.code} disabled={isTranslating !== null || isTranslatingAll} onClick={() => (m.code === 'US' || localListing.translations?.[m.code]) ? setActiveMarketplace(m.code) : handleTranslate(m.code)} className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-black transition-all ${activeMarketplace === m.code ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm scale-105' : (m.code === 'US' || localListing.translations?.[m.code] ? 'border-slate-100 text-slate-600 hover:border-purple-300' : 'border-dashed border-slate-200 text-slate-400 hover:bg-slate-50')}`}>
                  <span className="flex items-center gap-2"><span>{m.flag}</span> {m.code}</span> {isTranslating === m.code && <Loader2 size={12} className="animate-spin" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
             <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Edit2 size={14} /> Global Editor &bull; {targetMktConfig.name} ({activeMarketplace.toUpperCase()})</h4>
               {activeMarketplace !== 'US' && <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-100"><Coins size={12} /> Localized Context</div>}
             </div>
             
             <div className="p-8 border-b border-slate-100 bg-slate-50/20 space-y-8">
               <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><DollarSign size={10} /> Price ({localizedPricing.currency})</label>
                   <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300 pointer-events-none">{localizedPricing.currency}</span>
                     <input type="number" step={activeMarketplace === 'JP' ? '1' : '0.01'} value={localizedPricing.price} readOnly={activeMarketplace !== 'US'} onChange={(e) => activeMarketplace === 'US' && handleFieldChange('cleaned.price', parseFloat(e.target.value) || 0)} onBlur={handleBlur} className={`w-full pl-12 pr-5 py-4 bg-white border ${activeMarketplace !== 'US' ? 'border-amber-100 bg-amber-50/30' : 'border-slate-200'} rounded-2xl text-xl font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner`} />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Truck size={10} /> Shipping ({localizedPricing.currency})</label>
                   <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300 pointer-events-none">{localizedPricing.currency}</span>
                     <input type="number" step={activeMarketplace === 'JP' ? '1' : '0.01'} value={localizedPricing.shipping} readOnly={activeMarketplace !== 'US'} onChange={(e) => activeMarketplace === 'US' && handleFieldChange('cleaned.shipping', parseFloat(e.target.value) || 0)} onBlur={handleBlur} className={`w-full pl-12 pr-5 py-4 bg-white border ${activeMarketplace !== 'US' ? 'border-amber-100 bg-amber-50/30' : 'border-slate-200'} rounded-2xl text-xl font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner`} />
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100/50">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Weight size={10} /> Localized Weight</label>
                    <div className="flex gap-2">
                      <input type="text" value={formatDecimal(displayVal('optimized_weight_value', 'item_weight_value'))} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_weight_value' : `translations.${activeMarketplace}.optimized_weight_value`, e.target.value)} onBlur={handleBlur} className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none shadow-sm" />
                      <input type="text" value={displayVal('optimized_weight_unit', 'item_weight_unit')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_weight_unit' : `translations.${activeMarketplace}.optimized_weight_unit`, e.target.value)} onBlur={handleBlur} placeholder="Unit" className="w-32 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-600 outline-none shadow-sm text-center" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Ruler size={10} /> Localized Dimensions</label>
                    <div className="flex gap-2">
                      <input placeholder="L" value={formatDecimal(displayVal('optimized_length', 'item_length'))} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_length' : `translations.${activeMarketplace}.optimized_length`, e.target.value)} onBlur={handleBlur} className="w-full px-2 py-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold shadow-sm" />
                      <input placeholder="W" value={formatDecimal(displayVal('optimized_width', 'item_width'))} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_width' : `translations.${activeMarketplace}.optimized_width`, e.target.value)} onBlur={handleBlur} className="w-full px-2 py-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold shadow-sm" />
                      <input placeholder="H" value={formatDecimal(displayVal('optimized_height', 'item_height'))} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_height' : `translations.${activeMarketplace}.optimized_height`, e.target.value)} onBlur={handleBlur} className="w-full px-2 py-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold shadow-sm" />
                      <input placeholder="Unit" value={displayVal('optimized_size_unit', 'item_size_unit')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_size_unit' : `translations.${activeMarketplace}.optimized_size_unit`, e.target.value)} onBlur={handleBlur} className="w-32 px-2 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center text-[10px] font-black text-indigo-600 shadow-sm" />
                    </div>
                  </div>
               </div>
             </div>

             {currentContent ? (
               <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                 <div className="space-y-2"><label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Localized Title</label><textarea value={currentContent.optimized_title || ''} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_title' : `translations.${activeMarketplace}.optimized_title`, e.target.value)} onBlur={handleBlur} className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-base font-bold text-slate-800 outline-none min-h-[100px] leading-relaxed transition-all shadow-sm" /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Search Keywords</label><input value={currentContent.search_keywords || ''} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.search_keywords' : `translations.${activeMarketplace}.search_keywords`, e.target.value)} onBlur={handleBlur} className="w-full px-5 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-mono tracking-tight text-slate-600 outline-none shadow-inner" /></div>
               </div>
             ) : (
               <div className="p-32 text-center flex flex-col items-center justify-center gap-6 flex-1 bg-slate-50/30"><div className="w-24 h-24 bg-white rounded-[2rem] border border-slate-100 shadow-xl flex items-center justify-center text-slate-100 transform rotate-12"><BrainCircuit size={48} /></div><div className="space-y-2 max-w-sm"><p className="text-slate-800 font-black text-xl tracking-tight uppercase">Ready to Optimize</p></div><button onClick={handleOptimize} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all">Start Engine</button></div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
