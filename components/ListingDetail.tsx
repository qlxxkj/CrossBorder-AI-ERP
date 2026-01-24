
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
import { getLocalizedUnit, calculateMarketLogistics } from './LogisticsEditor';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onNext: () => void;
  uiLang: UILanguage;
}

const LANG_NAME_MAP: Record<string, string> = {
  en: 'English', zh: 'Chinese', ja: 'Japanese', de: 'German', fr: 'French', it: 'Italian', es: 'Spanish', pt: 'Portuguese', pl: 'Polish', nl: 'Dutch', sv: 'Swedish', ar: 'Arabic'
};

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<'gemini' | 'openai' | 'deepseek'>(() => (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
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

  useEffect(() => { setLocalListing(listing); fetchPricingData(); }, [listing.id]);

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
    } finally { setIsSaving(false); }
  };

  const updateField = (field: string, value: any, shouldSync: boolean = false) => {
    const next = JSON.parse(JSON.stringify(localListing));
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
    setLocalListing(next);
    onUpdate(next);
    if (shouldSync) syncToSupabase(next);
  };

  const processAndUploadImage = async (imgUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `${CORS_PROXY}${encodeURIComponent(imgUrl)}`;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1600; canvas.height = 1600;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,1600,1600);
        const scale = Math.min(1600/img.width, 1600/img.height);
        ctx.drawImage(img, (1600-img.width*scale)/2, (1600-img.height*scale)/2, img.width*scale, img.height*scale);
        canvas.toBlob(async (blob) => {
          if (!blob) return reject("Blob creation failed");
          const fd = new FormData();
          fd.append('file', blob, `std_${Date.now()}.jpg`);
          try {
            const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
            const data = await res.json();
            const u = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
            resolve(u || imgUrl);
          } catch (e) { reject(e); }
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => reject("Image load error");
    });
  };

  const handleStandardizeOne = async (url: string) => {
    setIsProcessingImages(true);
    try {
      const newUrl = await processAndUploadImage(url);
      if (localListing.cleaned.main_image === url) {
        updateField('main_image', newUrl, true);
        setPreviewImage(newUrl);
      } else {
        const others = (localListing.cleaned.other_images || []).map(u => u === url ? newUrl : u);
        updateField('other_images', others, true);
      }
    } catch (e) { alert("Failed to standardize image."); }
    finally { setIsProcessingImages(false); }
  };

  const handleStandardizeAll = async () => {
    setIsProcessingImages(true);
    const all = [localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])].filter(Boolean) as string[];
    const nextList = JSON.parse(JSON.stringify(localListing));
    try {
      const results = await Promise.all(all.map(u => processAndUploadImage(u)));
      nextList.cleaned.main_image = results[0];
      nextList.cleaned.other_images = results.slice(1);
      setLocalListing(nextList);
      setPreviewImage(results[0]);
      onUpdate(nextList);
      await syncToSupabase(nextList);
    } catch (e) { alert("Batch standardization failed."); }
    finally { setIsProcessingImages(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
        const data = await res.json();
        return Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
      });
      const results = await Promise.all(uploadPromises);
      const newOthers = [...(localListing.cleaned.other_images || []), ...results.filter(Boolean)];
      updateField('other_images', newOthers, true);
    } catch (e) { alert("Upload failed."); }
    finally { setIsProcessingImages(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleOptimizeMaster = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      const source = { ...localListing.cleaned };
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(source);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(source);
      else opt = await optimizeListingWithAI(source);
      const next = { ...localListing, optimized: opt, status: 'optimized' as const };
      setLocalListing(next); onUpdate(next); await syncToSupabase(next);
    } catch (error: any) { alert(`Optimization failed: ${error.message}`); } 
    finally { setIsOptimizing(false); }
  };

  const performTranslation = async (currentListing: Listing, marketCode: string): Promise<Listing> => {
    const mktConfig = AMAZON_MARKETPLACES.find(m => m.code === marketCode);
    const targetLangName = LANG_NAME_MAP[mktConfig?.lang || 'en'] || 'English';
    const source = currentListing.optimized || { optimized_title: currentListing.cleaned.title, optimized_features: currentListing.cleaned.features || [], optimized_description: currentListing.cleaned.description || "", search_keywords: currentListing.cleaned.search_keywords || "" } as OptimizedData;
    let transResult: any;
    if (engine === 'openai') transResult = await translateListingWithOpenAI(source, targetLangName);
    else if (engine === 'deepseek') transResult = await translateListingWithDeepSeek(source, targetLangName);
    else transResult = await translateListingWithAI(source, targetLangName);
    const logistics = calculateMarketLogistics(currentListing, marketCode);
    const rate = exchangeRates.find(r => r.marketplace === marketCode)?.rate || 1;
    const finalData: OptimizedData = { ...transResult, ...logistics, optimized_price: parseFloat(((currentListing.cleaned.price || 0) * rate).toFixed(2)), optimized_shipping: parseFloat(((currentListing.cleaned.shipping || 0) * rate).toFixed(2)) };
    return { ...currentListing, translations: { ...(currentListing.translations || {}), [marketCode]: finalData } };
  };

  const handleTranslateSingle = async (code: string, force: boolean = false) => {
    if (code === 'US' || (translatingMarkets.has(code) && !force)) return;
    setTranslatingMarkets(prev => new Set(prev).add(code));
    try {
      const nextListing = await performTranslation(localListing, code);
      setLocalListing(nextListing); onUpdate(nextListing); await syncToSupabase(nextListing);
    } finally { setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(code); return n; }); }
  };

  const handleTranslateAll = async () => {
    const targets = AMAZON_MARKETPLACES.filter(m => m.code !== 'US');
    setIsTranslatingAll(true);
    setTranslationProgress({ current: 0, total: targets.length });
    let workingListing = { ...localListing };
    try {
      for (let i = 0; i < targets.length; i++) {
        const m = targets[i];
        setTranslationProgress(prev => ({ ...prev, current: i + 1 }));
        setTranslatingMarkets(prev => new Set(prev).add(m.code));
        try { workingListing = await performTranslation(workingListing, m.code); setLocalListing(workingListing); onUpdate(workingListing); } 
        finally { setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(m.code); return n; }); }
        await new Promise(r => setTimeout(r, 100));
      }
      await syncToSupabase(workingListing);
    } finally { setIsTranslatingAll(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar onBack={onBack} engine={engine} setEngine={(e) => { setEngine(e); localStorage.setItem('amzbot_preferred_engine', e); }} onOptimize={handleOptimizeMaster} isOptimizing={isOptimizing} onSave={() => syncToSupabase(localListing)} isSaving={isSaving} onNext={onNext} uiLang={uiLang} />
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection listing={localListing} previewImage={previewImage} setPreviewImage={setPreviewImage} updateField={(f, v) => updateField(f, v, true)} isSaving={isSaving} isProcessing={isProcessingImages} onStandardizeAll={handleStandardizeAll} onStandardizeOne={handleStandardizeOne} setShowEditor={setShowImageEditor} fileInputRef={fileInputRef} />
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
             <ListingSourcingSection listing={localListing} updateField={(f, v) => updateField(f, v, true)} setShowModal={setShowSourcingModal} setShowForm={setShowSourcingForm} setEditingRecord={setEditingSourceRecord} />
          </div>
          <div className="lg:col-span-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                   <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                      <button onClick={() => setActiveMarket('US')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>🇺🇸 Master</button>
                      {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => {
                        const hasTrans = !!localListing.translations?.[m.code];
                        return (
                          <div key={m.code} className="flex shrink-0">
                             <button onClick={async () => { setActiveMarket(m.code); if (!hasTrans) await handleTranslateSingle(m.code); }} className={`px-4 py-2.5 rounded-l-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-y-2 border-l-2 ${activeMarket === m.code ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : hasTrans ? 'bg-white text-indigo-600 border-slate-100' : 'bg-slate-50 text-slate-300 border-slate-200 border-dashed opacity-60'}`}>
                              {m.flag} {m.code} {translatingMarkets.has(m.code) && <Loader2 size={10} className="animate-spin" />}
                             </button>
                             {hasTrans && <button onClick={(e) => { e.stopPropagation(); handleTranslateSingle(m.code, true); }} className={`px-2.5 py-2.5 rounded-r-xl border-y-2 border-r-2 ${activeMarket === m.code ? 'bg-indigo-700 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}><RefreshCw size={11} /></button>}
                          </div>
                        );
                      })}
                   </div>
                   <button onClick={handleTranslateAll} disabled={isTranslatingAll} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2 shrink-0">
                     {isTranslatingAll ? <><Loader2 size={14} className="animate-spin" /> Translating ({translationProgress.current}/{translationProgress.total})...</> : <><Languages size={14} /> AI Translate All</>}
                   </button>
                </div>
                <ListingEditorArea listing={localListing} activeMarket={activeMarket} updateField={updateField} onSync={() => syncToSupabase(localListing)} onRecalculate={() => {
                  const converted = calculateMarketLogistics(localListing, activeMarket);
                  Object.entries(converted).forEach(([k, v]) => updateField(k, v));
                  syncToSupabase(localListing);
                }} uiLang={uiLang} />
             </div>
          </div>
        </div>
      </div>
      {showSourcingModal && <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={res => { const n = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] }; setLocalListing(n); updateField('sourcing_data', n.sourcing_data, true); setShowSourcingModal(false); }} />}
      {showSourcingForm && <SourcingFormModal initialData={editingSourceRecord} onClose={() => setShowSourcingForm(false)} onSave={res => { let n; if (editingSourceRecord) { n = { ...localListing, sourcing_data: (localListing.sourcing_data || []).map(s => s.id === res.id ? res : s) }; } else { n = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), { ...res, id: `m-${Date.now()}` }] }; } setLocalListing(n); updateField('sourcing_data', n.sourcing_data, true); setShowSourcingForm(false); }} />}
      {showImageEditor && <ImageEditor imageUrl={previewImage} onClose={() => setShowImageEditor(false)} onSave={(url) => { setPreviewImage(url); updateField('main_image', url, true); setShowImageEditor(false); }} uiLang={uiLang} />}
    </div>
  );
};
