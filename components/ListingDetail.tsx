
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
import { calculateMarketLogistics } from './LogisticsEditor';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onDelete: (id: string) => Promise<void>;
  onNext: () => void;
  uiLang: UILanguage;
}

const LANG_NAME_MAP: Record<string, string> = {
  en: 'English', zh: 'Chinese', ja: 'Japanese', de: 'German', fr: 'French', it: 'Italian', es: 'Spanish', pt: 'Portuguese', pl: 'Polish', nl: 'Dutch', sv: 'Swedish', ar: 'Arabic'
};

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onDelete, onNext, uiLang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<'gemini' | 'openai' | 'deepseek'>(() => (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
  const [translatingMarkets, setTranslatingMarkets] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [processingUrls, setProcessingUrls] = useState<Set<string>>(new Set());
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string>(''); 
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState(false);
  const [editingSourceRecord, setEditingSourceRecord] = useState<SourcingRecord | null>(null);
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => { 
    setLocalListing(listing); 
    const effectiveMain = listing.optimized?.optimized_main_image || listing.cleaned?.main_image || '';
    setPreviewImage(effectiveMain); 
    fetchPricingData(); 
  }, [listing.id]);

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
    } catch (e) {
      console.error("Supabase sync failed:", e);
    } finally { setIsSaving(false); }
  };

  const updateFields = (updates: Record<string, any>, shouldSync: boolean = false) => {
    setLocalListing(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      Object.entries(updates).forEach(([field, value]) => {
        if (activeMarket === 'US') {
          if (['main_image', 'other_images', 'optimized_main_image', 'optimized_other_images'].includes(field)) {
            const optKey = field.startsWith('optimized') ? field : (field === 'main_image' ? 'optimized_main_image' : 'optimized_other_images');
            next.optimized = { ...(next.optimized || {}), [optKey]: value };
          } else if (field === 'sourcing_data') {
            next.sourcing_data = value;
          } else {
            next.optimized = { ...(next.optimized || {}), [field]: value } as OptimizedData;
          }
        } else {
          const trans = { ...(next.translations || {}) };
          trans[activeMarket] = { ...(trans[activeMarket] || {}), [field]: value } as OptimizedData;
          next.translations = trans;
        }
      });
      onUpdate(next);
      if (shouldSync) syncToSupabase(next);
      return next;
    });
  };

  const updateField = (field: string, value: any, shouldSync: boolean = false) => {
    updateFields({ [field]: value }, shouldSync);
  };

  // 标准化并上传：1600x1600，白色背景，内容 1500px 居中
  const processAndUploadImage = async (imgUrl: string): Promise<string> => {
    if (!imgUrl) return "";
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const sourceUrl = (imgUrl.startsWith('data:') || imgUrl.startsWith('blob:')) 
        ? imgUrl 
        : `${CORS_PROXY}${encodeURIComponent(imgUrl)}`;
      
      img.src = sourceUrl;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1600; 
          canvas.height = 1600;
          const ctx = canvas.getContext('2d')!;
          
          // 1. 白色背景
          ctx.fillStyle = '#FFFFFF'; 
          ctx.fillRect(0, 0, 1600, 1600);
          
          // 2. 缩放计算 (长边 1500px)
          const scale = Math.min(1500 / img.width, 1500 / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          
          // 3. 居中坐标
          const offsetX = (1600 - drawW) / 2;
          const offsetY = (1600 - drawH) / 2;
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
          
          canvas.toBlob(async (blob) => {
            if (!blob) return resolve(imgUrl);
            const fd = new FormData();
            fd.append('file', blob, `std_${Date.now()}.jpg`);
            try {
              const res = await fetch(TARGET_API, { method: 'POST', body: fd });
              if (!res.ok) throw new Error("Upload Failed");
              const data = await res.json();
              const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
              const finalUrl = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
              resolve(finalUrl || imgUrl);
            } catch (e) { resolve(imgUrl); }
          }, 'image/jpeg', 0.95);
        } catch (e) { resolve(imgUrl); }
      };
      img.onerror = () => resolve(imgUrl);
    });
  };

  const handleStandardizeOne = async (url: string) => {
    if (processingUrls.has(url)) return;
    setProcessingUrls(prev => new Set(prev).add(url));
    try {
      const newUrl = await processAndUploadImage(url);
      if (newUrl === url) return;

      const nextListing = JSON.parse(JSON.stringify(localListing));
      const currentMain = nextListing.optimized?.optimized_main_image || nextListing.cleaned.main_image;
      
      if (currentMain === url) {
        nextListing.optimized = { ...(nextListing.optimized || {}), optimized_main_image: newUrl };
      } else {
        const currentOthers = [...(nextListing.optimized?.optimized_other_images || nextListing.cleaned.other_images || [])];
        const idx = currentOthers.indexOf(url);
        if (idx > -1) {
          currentOthers[idx] = newUrl;
          nextListing.optimized = { ...(nextListing.optimized || {}), optimized_other_images: currentOthers };
        }
      }
      
      if (previewImage === url) setPreviewImage(newUrl);
      setLocalListing(nextListing);
      onUpdate(nextListing);
      await syncToSupabase(nextListing);
    } finally { 
      setProcessingUrls(prev => { const n = new Set(prev); n.delete(url); return n; }); 
    }
  };

  const handleStandardizeAll = async () => {
    if (isProcessingImages) return;
    setIsProcessingImages(true);
    const effectiveMain = localListing.optimized?.optimized_main_image || localListing.cleaned.main_image || "";
    const effectiveOthers = localListing.optimized?.optimized_other_images || localListing.cleaned.other_images || [];
    const all = [effectiveMain, ...effectiveOthers].filter(Boolean) as string[];
    all.forEach(u => setProcessingUrls(prev => new Set(prev).add(u)));
    
    try {
      const results = await Promise.all([
        effectiveMain ? processAndUploadImage(effectiveMain) : Promise.resolve(""),
        ...effectiveOthers.map(u => processAndUploadImage(u))
      ]);
      const newMain = results[0];
      const newOthers = results.slice(1);
      
      const nextListing = JSON.parse(JSON.stringify(localListing));
      nextListing.optimized = { 
        ...(nextListing.optimized || {}), 
        optimized_main_image: newMain || nextListing.optimized?.optimized_main_image,
        optimized_other_images: newOthers
      };
      
      if (previewImage === effectiveMain && newMain) setPreviewImage(newMain);
      setLocalListing(nextListing);
      onUpdate(nextListing);
      await syncToSupabase(nextListing);
    } finally { 
      setIsProcessingImages(false); 
      setProcessingUrls(new Set()); 
    }
  };

  const handleOptimizeMaster = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      const source = { ...localListing.cleaned };
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(source);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(source);
      else opt = await optimizeListingWithAI(source);
      
      const finalOpt = { 
        ...opt, 
        optimized_main_image: localListing.optimized?.optimized_main_image,
        optimized_other_images: localListing.optimized?.optimized_other_images
      };
      
      const next = { ...localListing, optimized: finalOpt, status: 'optimized' as const };
      setLocalListing(next); onUpdate(next); await syncToSupabase(next);
    } catch (error: any) { alert(`Optimization failed: ${error.message}`); } 
    finally { setIsOptimizing(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar onBack={onBack} engine={engine} setEngine={(e) => { setEngine(e); localStorage.setItem('amzbot_preferred_engine', e); }} onOptimize={handleOptimizeMaster} isOptimizing={isOptimizing} onSave={() => syncToSupabase(localListing)} onDelete={() => onDelete(localListing.id)} isSaving={isSaving} onNext={onNext} uiLang={uiLang} />
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection listing={localListing} previewImage={previewImage} setPreviewImage={setPreviewImage} updateField={(f, v) => updateField(f, v, true)} updateFields={(fields) => updateFields(fields, true)} isSaving={isSaving} isProcessing={isProcessingImages} processingUrls={processingUrls} onStandardizeAll={handleStandardizeAll} onStandardizeOne={handleStandardizeOne} onRestoreAll={() => {
                const next = JSON.parse(JSON.stringify(localListing));
                if (next.optimized) { delete next.optimized.optimized_main_image; delete next.optimized.optimized_other_images; }
                setLocalListing(next); setPreviewImage(next.cleaned.main_image || ''); onUpdate(next); syncToSupabase(next);
             }} setShowEditor={(show) => { if (show) setEditingImageUrl(previewImage); setShowImageEditor(show); }} fileInputRef={fileInputRef} />
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={async (e) => {
               const files = e.target.files; if (!files?.length) return;
               setIsProcessingImages(true);
               try {
                 const newUrls = await Promise.all(Array.from(files).map(async f => {
                   const fd = new FormData(); fd.append('file', f);
                   const res = await fetch(TARGET_API, { method: 'POST', body: fd });
                   const data = await res.json();
                   const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
                   return rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
                 }));
                 const currentOthers = localListing.optimized?.optimized_other_images || localListing.cleaned.other_images || [];
                 updateField('optimized_other_images', [...currentOthers, ...newUrls.filter(Boolean)], true);
               } finally { setIsProcessingImages(false); }
             }} />
             <ListingSourcingSection listing={localListing} updateField={(f, v) => updateField(f, v, true)} setShowModal={setShowSourcingModal} setShowForm={setShowSourcingForm} setEditingRecord={setEditingSourceRecord} />
          </div>
          <div className="lg:col-span-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                   <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                      <button onClick={() => setActiveMarket('US')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>🇺🇸 Master</button>
                      {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => (
                         <button key={m.code} onClick={() => setActiveMarket(m.code)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === m.code ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>{m.flag} {m.code}</button>
                      ))}
                   </div>
                   <button onClick={() => setIsTranslatingAll(true)} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2"><Languages size={14} /> AI Translate All</button>
                </div>
                <ListingEditorArea listing={localListing} activeMarket={activeMarket} updateField={updateField} onSync={() => syncToSupabase(localListing)} onRecalculate={() => {}} uiLang={uiLang} />
             </div>
          </div>
        </div>
      </div>
      {showImageEditor && <ImageEditor imageUrl={editingImageUrl} onClose={() => setShowImageEditor(false)} onSave={(newUrl) => { 
        updateField(localListing.optimized?.optimized_main_image === editingImageUrl ? 'optimized_main_image' : 'optimized_other_images', 
          localListing.optimized?.optimized_main_image === editingImageUrl ? newUrl : (localListing.optimized?.optimized_other_images || []).map(u => u === editingImageUrl ? newUrl : u), true);
        setPreviewImage(newUrl); setShowImageEditor(false); 
      }} uiLang={uiLang} />}
    </div>
  );
};
