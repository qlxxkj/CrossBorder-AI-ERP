
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Languages, RefreshCw, Zap } from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, ExchangeRate, SourcingRecord } from '../types';
import { ListingTopBar } from './ListingTopBar';
import { ListingImageSection } from './ListingImageSection';
import { ListingSourcingSection } from './ListingSourcingSection';
import { ListingEditorArea } from './ListingEditorArea';
import { ImageEditor } from './ImageEditor';
import { SourcingModal } from './SourcingModal';
import { SourcingFormModal } from './SourcingFormModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from '../services/openaiService';
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from '../services/deepseekService';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onNext: () => void;
  uiLang: UILanguage;
}

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

/**
 * 单位全拼标准 Sentence Case 映射
 */
const mapStandardUnit = (unit: string, market: string) => {
  const u = unit.toLowerCase().trim();
  if (market === 'JP') {
    const jp: Record<string, string> = { 'kg': 'キログラム', 'cm': 'センチメートル', 'lb': 'ポンド', 'in': 'インチ' };
    return jp[u] || unit;
  }
  if (market === 'EG' || market === 'SA' || market === 'AE') {
    const ar: Record<string, string> = { 'kg': 'كيلوجرام', 'cm': 'سنتيمتر', 'lb': 'رطل', 'in': 'بوصة' };
    return ar[u] || unit;
  }
  
  const latin: Record<string, string> = {
    'kg': 'Kilograms', 'kilogram': 'Kilograms', 'kilograms': 'Kilograms',
    'cm': 'Centimeters', 'centimeter': 'Centimeters', 'centimeters': 'Centimeters',
    'lb': 'Pounds', 'pound': 'Pounds', 'pounds': 'Pounds',
    'in': 'Inches', 'inch': 'Inches', 'inches': 'Inches'
  };
  return latin[u] || (unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase());
};

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<'gemini' | 'openai' | 'deepseek'>(() => (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
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
      await supabase.from('listings').update({
        cleaned: targetListing.cleaned,
        optimized: targetListing.optimized || null,
        translations: targetListing.translations || null,
        status: targetListing.status,
        sourcing_data: targetListing.sourcing_data || [],
        updated_at: new Date().toISOString()
      }).eq('id', targetListing.id);
    } catch (e) {} finally { setIsSaving(false); }
  };

  const updateField = (field: string, value: any) => {
    setLocalListing(prev => {
      const next = { ...prev };
      if (activeMarket === 'US') {
        if (['main_image', 'other_images', 'sourcing_data'].includes(field)) {
          if (field === 'sourcing_data') next.sourcing_data = value;
          else next.cleaned = { ...next.cleaned, [field]: value };
        } else {
          next.optimized = { ...(next.optimized || {}), [field]: value } as OptimizedData;
        }
      } else {
        const trans = { ...(next.translations || {}) };
        trans[activeMarket] = { ...(trans[activeMarket] || {}), [field]: value } as OptimizedData;
        next.translations = trans;
      }
      onUpdate(next);
      return next;
    });
  };

  const standardizeImage = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject();
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
          if (!blob) return reject();
          const fd = new FormData(); fd.append('file', new File([blob], `std_${Date.now()}.jpg`, { type: 'image/jpeg' }));
          const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
          const data = await res.json();
          resolve(Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url);
        }, 'image/jpeg', 0.95);
      };
      img.onerror = reject;
    });
  };

  const handleStandardizeAll = async () => {
    setIsProcessingImages(true);
    try {
      const newMain = await standardizeImage(localListing.cleaned.main_image || '');
      const newOthers = await Promise.all((localListing.cleaned.other_images || []).map(u => standardizeImage(u)));
      updateField('main_image', newMain);
      updateField('other_images', newOthers);
      setPreviewImage(newMain);
    } catch (e) { alert("Failed"); } finally { setIsProcessingImages(false); }
  };

  /**
   * 物流换算强制溯源引擎
   */
  const performLogisticsConversion = (targetMkt: string) => {
    // 强制回溯 Master 站点
    const opt = localListing.optimized;
    const clean = localListing.cleaned;
    const isMetric = !['US', 'CA', 'UK'].includes(targetMkt);
    
    // 基础源数据：优先取 Master 优化后的，没有则取采集原始的
    const sUnitW = String(opt?.optimized_weight_unit || clean.item_weight_unit || "lb").toLowerCase();
    const sUnitS = String(opt?.optimized_size_unit || clean.item_size_unit || "in").toLowerCase();
    
    let valW = opt?.optimized_weight_value || clean.item_weight_value || "";
    let l = opt?.optimized_length || clean.item_length || "";
    let w = opt?.optimized_width || clean.item_width || "";
    let h = opt?.optimized_height || clean.item_height || "";
    
    const num = (v: any) => {
      const n = parseFloat(String(v || "0").replace(/[^0-9.]/g, ''));
      return isNaN(n) ? 0 : n;
    };

    if (isMetric) {
      // 换算至公制
      if (sUnitW.includes('lb') || sUnitW.includes('pound')) {
        const n = num(valW); valW = n > 0 ? (n * 0.453592).toFixed(2) : "";
      }
      if (sUnitS.includes('in') || sUnitS.includes('inch')) {
        const nl = num(l), nw = num(w), nh = num(h);
        l = nl > 0 ? (nl * 2.54).toFixed(2) : "";
        w = nw > 0 ? (nw * 2.54).toFixed(2) : "";
        h = nh > 0 ? (nh * 2.54).toFixed(2) : "";
      }
    } else {
      // 换算至英制 (针对 CA/UK 等虽然有时用公制但模板常要求英制的情况，或者反向同步)
      if (sUnitW.includes('kg') || sUnitW.includes('kilogram')) {
        const n = num(valW); valW = n > 0 ? (n / 0.453592).toFixed(2) : "";
      }
      if (sUnitS.includes('cm') || sUnitS.includes('centimeter')) {
        const nl = num(l), nw = num(w), nh = num(h);
        l = nl > 0 ? (nl / 2.54).toFixed(2) : "";
        w = nw > 0 ? (nw / 2.54).toFixed(2) : "";
        h = nh > 0 ? (nh / 2.54).toFixed(2) : "";
      }
    }

    return {
      optimized_weight_value: valW, 
      optimized_weight_unit: mapStandardUnit(isMetric ? 'kg' : 'lb', targetMkt),
      optimized_length: l, 
      optimized_width: w, 
      optimized_height: h, 
      optimized_size_unit: mapStandardUnit(isMetric ? 'cm' : 'in', targetMkt)
    };
  };

  const translateMarket = async (code: string, force: boolean = false) => {
    if (code === 'US' || (translatingMarkets.has(code) && !force)) return;
    setTranslatingMarkets(prev => new Set(prev).add(code));
    try {
      const source = localListing.optimized || { optimized_title: localListing.cleaned.title, optimized_features: localListing.cleaned.features || [] } as OptimizedData;
      const targetLang = AMAZON_MARKETPLACES.find(m => m.code === code)?.name || 'English';
      
      let trans: any;
      if (engine === 'openai') trans = await translateListingWithOpenAI(source, targetLang);
      else if (engine === 'deepseek') trans = await translateListingWithDeepSeek(source, targetLang);
      else trans = await translateListingWithAI(source, targetLang);
      
      const logistics = performLogisticsConversion(code);
      const rate = exchangeRates.find(r => r.marketplace === code)?.rate || 1;
      
      const final: OptimizedData = {
        ...trans, 
        ...logistics,
        optimized_price: parseFloat(((localListing.cleaned.price || 0) * rate).toFixed(2)),
        optimized_shipping: parseFloat(((localListing.cleaned.shipping || 0) * rate).toFixed(2))
      };
      
      setLocalListing(prev => {
        const next = { ...prev, translations: { ...(prev.translations || {}), [code]: final } };
        onUpdate(next);
        return next;
      });
    } catch (e) {
      console.error(`Translation failed for ${code}`, e);
    } finally {
      setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(code); return n; });
    }
  };

  const handleTranslateAll = async () => {
    setIsTranslatingAll(true);
    const untranslatedMarkets = AMAZON_MARKETPLACES.filter(m => m.code !== 'US');
    for (const market of untranslatedMarkets) {
      await translateMarket(market.code);
      await new Promise(r => setTimeout(r, 600));
    }
    setIsTranslatingAll(false);
    await syncToSupabase(localListing);
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(localListing.cleaned);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(localListing.cleaned);
      else opt = await optimizeListingWithAI(localListing.cleaned);
      const next: Listing = { ...localListing, optimized: opt, status: 'optimized' };
      setLocalListing(next); onUpdate(next); await syncToSupabase(next);
    } catch (e) {} finally { setIsOptimizing(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar onBack={onBack} engine={engine} setEngine={(e) => { setEngine(e); localStorage.setItem('amzbot_preferred_engine', e); }} onOptimize={handleOptimize} isOptimizing={isOptimizing} onSave={() => syncToSupabase(localListing)} isSaving={isSaving} onNext={onNext} uiLang={uiLang} />
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection listing={localListing} previewImage={previewImage} setPreviewImage={setPreviewImage} updateField={updateField} isSaving={isSaving} isProcessing={isProcessingImages} onStandardizeAll={handleStandardizeAll} onStandardizeOne={(u) => standardizeImage(u).then(n => { if(u === localListing.cleaned.main_image) { updateField('main_image', n); setPreviewImage(n); } else { updateField('other_images', localListing.cleaned.other_images?.map(x => x === u ? n : x)); } })} setShowEditor={setShowImageEditor} fileInputRef={fileInputRef} />
             <ListingSourcingSection listing={localListing} updateField={updateField} setShowModal={setShowSourcingModal} setShowForm={setShowSourcingForm} setEditingRecord={setEditingSourceRecord} />
          </div>
          <div className="lg:col-span-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                   <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                      <button onClick={() => setActiveMarket('US')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>🇺🇸 Master</button>
                      {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => {
                        const hasTrans = !!localListing.translations?.[m.code];
                        const isTranslating = translatingMarkets.has(m.code);
                        return (
                          <div key={m.code} className="flex shrink-0">
                             <button 
                              onClick={async () => { setActiveMarket(m.code); if (!hasTrans) await translateMarket(m.code); }} 
                              className={`px-4 py-2.5 rounded-l-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-y-2 border-l-2 ${activeMarket === m.code ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : hasTrans ? 'bg-white text-indigo-600 border-slate-100' : 'bg-slate-50 text-slate-300 border-slate-200 border-dashed opacity-60 hover:opacity-100'}`}
                             >
                              {m.flag} {m.code} {isTranslating && <Loader2 size={10} className="animate-spin" />}
                             </button>
                             {hasTrans && (
                               <button 
                                onClick={(e) => { e.stopPropagation(); translateMarket(m.code, true); }}
                                className={`px-2 py-2.5 rounded-r-xl border-y-2 border-r-2 transition-all ${activeMarket === m.code ? 'bg-indigo-700 text-white border-indigo-600 hover:bg-indigo-800' : 'bg-slate-50 text-slate-400 border-slate-100 hover:text-indigo-600'}`}
                                title="Re-translate"
                               >
                                 <RefreshCw size={10} className={isTranslating ? 'animate-spin' : ''} />
                               </button>
                             )}
                          </div>
                        );
                      })}
                   </div>
                   <button 
                    onClick={handleTranslateAll} 
                    disabled={isTranslatingAll}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
                   >
                     {isTranslatingAll ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} AI Translate All
                   </button>
                </div>
                <ListingEditorArea listing={localListing} activeMarket={activeMarket} updateField={updateField} onSync={() => syncToSupabase(localListing)} onRecalculate={() => { const res = performLogisticsConversion(activeMarket); Object.entries(res).forEach(([k,v]) => updateField(k,v)); }} uiLang={uiLang} />
             </div>
          </div>
        </div>
      </div>
      {showSourcingModal && <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={res => { const n = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] }; setLocalListing(n); updateField('sourcing_data', n.sourcing_data); setShowSourcingModal(false); }} />}
      {showSourcingForm && <SourcingFormModal initialData={editingSourceRecord} onClose={() => setShowSourcingForm(false)} onSave={record => { let data = [...(localListing.sourcing_data || [])]; if (editingSourceRecord) data = data.map(s => s.id === record.id ? record : s); else data.push(record); updateField('sourcing_data', data); setShowSourcingForm(false); }} />}
      {showImageEditor && <ImageEditor imageUrl={previewImage} onClose={() => setShowImageEditor(false)} onSave={u => { updateField('main_image', u); setPreviewImage(u); setShowImageEditor(false); }} uiLang={uiLang} />}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setIsSaving(true); const fd = new FormData(); fd.append('file', file); const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd }); const data = await res.json(); const u = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url; if (u) { updateField('other_images', [...(localListing.cleaned.other_images || []), u]); setPreviewImage(u); } setIsSaving(false); }} />
    </div>
  );
};
