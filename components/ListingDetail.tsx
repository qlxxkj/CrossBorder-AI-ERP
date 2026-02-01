
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Globe, Sparkles, RefreshCw, CheckCircle2, Plus, ChevronRight } from 'lucide-react';
import { Listing, OptimizedData, UILanguage, SourcingRecord, ExchangeRate, PriceAdjustment } from '../types';
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
import { calculateMarketLogistics, calculateMarketPrice } from './LogisticsEditor';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onDelete: (id: string) => Promise<void>;
  onNext: () => void;
  uiLang: UILanguage;
}

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onDelete, onNext, uiLang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<'gemini' | 'openai' | 'deepseek'>(() => (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateStatus, setTranslateStatus] = useState({ current: 0, total: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [processingUrls, setProcessingUrls] = useState<Set<string>>(new Set());
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string>(''); 
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState(false);
  const [editingSourceRecord, setEditingSourceRecord] = useState<SourcingRecord | null>(null);
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [previewImage, setPreviewImage] = useState<string>('');
  
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>([]);

  useEffect(() => { 
    setLocalListing(listing); 
    const initialImg = listing.optimized?.optimized_main_image || listing.cleaned?.main_image || '';
    setPreviewImage(initialImg); 
    localStorage.setItem('amzbot_preferred_engine', engine);
    fetchCalculations();
  }, [listing.id, engine]);

  const fetchCalculations = async () => {
    if (!isSupabaseConfigured()) return;
    const [rRes, aRes] = await Promise.all([
      supabase.from('exchange_rates').select('*'),
      supabase.from('price_adjustments').select('*')
    ]);
    if (rRes.data) setRates(rRes.data);
    if (aRes.data) setAdjustments(aRes.data);
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

  const updateFields = (updates: Record<string, any>, shouldSync: boolean = false) => {
    setLocalListing(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      Object.entries(updates).forEach(([field, value]) => {
        if (activeMarket === 'US') {
          if (['main_image', 'other_images', 'optimized_main_image', 'optimized_other_images'].includes(field)) {
            const optKey = field.startsWith('optimized') ? field : (field === 'main_image' ? 'optimized_main_image' : 'optimized_other_images');
            next.optimized = { ...(next.optimized || {}), [optKey]: value };
          } else {
            next.optimized = { ...(next.optimized || {}), [field]: value };
          }
        } else {
          const trans = { ...(next.translations || {}) };
          trans[activeMarket] = { ...(trans[activeMarket] || {}), [field]: value };
          next.translations = trans;
        }
      });
      onUpdate(next);
      if (shouldSync) syncToSupabase(next);
      return next;
    });
  };

  const translateSite = async (marketCode: string) => {
    if (!localListing.optimized || isTranslating) return;
    setIsTranslating(true);
    try {
      const market = AMAZON_MARKETPLACES.find(m => m.code === marketCode);
      const targetLang = market?.name || marketCode;
      
      let translation;
      if (engine === 'openai') {
        translation = await translateListingWithOpenAI(localListing.optimized, targetLang);
      } else if (engine === 'deepseek') {
        translation = await translateListingWithDeepSeek(localListing.optimized, targetLang);
      } else {
        translation = await translateListingWithAI(localListing.optimized, targetLang);
      }

      const logistics = calculateMarketLogistics(localListing, marketCode);
      const priceData = calculateMarketPrice(localListing, marketCode, rates, adjustments);

      const next: Listing = {
        ...localListing,
        translations: {
          ...(localListing.translations || {}),
          [marketCode]: { ...translation, ...logistics, ...priceData } as OptimizedData
        }
      };
      
      setLocalListing(next);
      onUpdate(next);
      await syncToSupabase(next);
    } catch (e) {
      console.error(`Translation error for ${marketCode}:`, e);
    } finally {
      setIsTranslating(false);
    }
  };

  const translateAllMarkets = async () => {
    if (!localListing.optimized || isTranslating) return;
    const marketsToTranslate = AMAZON_MARKETPLACES.filter(m => m.code !== 'US');
    setIsTranslating(true);
    setTranslateStatus({ current: 0, total: marketsToTranslate.length });

    try {
      let currentListing = JSON.parse(JSON.stringify(localListing)) as Listing;

      for (let i = 0; i < marketsToTranslate.length; i++) {
        const m = marketsToTranslate[i];
        setTranslateStatus({ current: i + 1, total: marketsToTranslate.length });
        
        const targetLang = m.name;
        let translation;
        if (engine === 'openai') {
          translation = await translateListingWithOpenAI(localListing.optimized, targetLang);
        } else if (engine === 'deepseek') {
          translation = await translateListingWithDeepSeek(localListing.optimized, targetLang);
        } else {
          translation = await translateListingWithAI(localListing.optimized, targetLang);
        }

        const logistics = calculateMarketLogistics(currentListing, m.code);
        const priceData = calculateMarketPrice(currentListing, m.code, rates, adjustments);

        currentListing.translations = {
          ...(currentListing.translations || {}),
          [m.code]: { ...translation, ...logistics, ...priceData } as OptimizedData
        };
      }

      setLocalListing(currentListing);
      onUpdate(currentListing);
      await syncToSupabase(currentListing);
    } catch (e) {
      console.error("Batch translation error:", e);
    } finally {
      setIsTranslating(false);
      setTranslateStatus({ current: 0, total: 0 });
    }
  };

  const processAndUploadImage = async (imgUrl: string): Promise<string> => {
    if (!imgUrl) return "";
    setProcessingUrls(prev => { const n = new Set(prev); n.add(imgUrl); return n; });
    
    return new Promise(async (resolve) => {
      try {
        const proxied = (imgUrl.startsWith('data:') || imgUrl.startsWith('blob:')) 
          ? imgUrl : `${CORS_PROXY}${encodeURIComponent(imgUrl)}`;
        
        // 核心修复：通过 fetch Blob 彻底绕过 Canvas 跨域“污染”导出失败
        const response = await fetch(proxied);
        const blob = await response.blob();
        const localObjUrl = URL.createObjectURL(blob);
        
        const img = new Image();
        img.src = localObjUrl;
        await img.decode();
        
        const canvas = document.createElement('canvas');
        canvas.width = 1600; 
        canvas.height = 1600;
        const ctx = canvas.getContext('2d')!;
        
        // 强制背景颜色为白色
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 1600, 1600);
        
        const targetLimit = 1500;
        const scale = Math.min(targetLimit / img.width, targetLimit / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (1600 - dw) / 2;
        const dy = (1600 - dh) / 2;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, dx, dy, dw, dh);
        
        URL.revokeObjectURL(localObjUrl); // 清理内存

        canvas.toBlob(async (outBlob) => {
          if (!outBlob) {
            setProcessingUrls(prev => { const n = new Set(prev); n.delete(imgUrl); return n; });
            return resolve(imgUrl);
          }
          const fd = new FormData();
          fd.append('file', outBlob, `std1600_${Date.now()}.jpg`);
          try {
            const res = await fetch(TARGET_API, { method: 'POST', body: fd });
            const data = await res.json();
            const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
            const finalUrl = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
            
            setProcessingUrls(prev => { const n = new Set(prev); n.delete(imgUrl); return n; });
            resolve(finalUrl || imgUrl);
          } catch (e) { 
            setProcessingUrls(prev => { const n = new Set(prev); n.delete(imgUrl); return n; });
            resolve(imgUrl); 
          }
        }, 'image/jpeg', 0.98);
      } catch (e) {
        console.error("Standardization Crash:", e);
        setProcessingUrls(prev => { const n = new Set(prev); n.delete(imgUrl); return n; });
        resolve(imgUrl);
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImages(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(TARGET_API, { method: 'POST', body: fd });
      const data = await res.json();
      const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
      const url = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
      
      if (url) {
        const next = JSON.parse(JSON.stringify(localListing)) as Listing;
        const currentOthers = next.optimized?.optimized_other_images || next.cleaned.other_images || [];
        next.optimized = { 
          ...(next.optimized || {}), 
          optimized_other_images: [...currentOthers, url] 
        } as OptimizedData;
        setLocalListing(next);
        onUpdate(next);
        await syncToSupabase(next);
        setPreviewImage(url);
      }
    } catch (err) { alert("Upload failed"); } 
    finally { 
      setIsProcessingImages(false); 
      if (e.target) e.target.value = ''; 
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar onBack={onBack} engine={engine} setEngine={setEngine} onOptimize={async () => {
        setIsOptimizing(true);
        try {
          const opt = engine === 'openai' ? await optimizeListingWithOpenAI(localListing.cleaned) : engine === 'deepseek' ? await optimizeListingWithDeepSeek(localListing.cleaned) : await optimizeListingWithAI(localListing.cleaned);
          const next: Listing = { ...localListing, optimized: { ...opt, optimized_main_image: localListing.optimized?.optimized_main_image, optimized_other_images: localListing.optimized?.optimized_other_images }, status: 'optimized' as const };
          setLocalListing(next); onUpdate(next); await syncToSupabase(next);
        } finally { setIsOptimizing(false); }
      }} isOptimizing={isOptimizing} onSave={() => syncToSupabase(localListing)} onDelete={() => onDelete(localListing.id)} isSaving={isSaving} onNext={onNext} uiLang={uiLang} />
      
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-20">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection listing={localListing} previewImage={previewImage} setPreviewImage={setPreviewImage} updateField={(f, v) => updateFields({[f]: v}, true)} updateFields={(fs) => updateFields(fs, true)} isSaving={isSaving} isProcessing={isProcessingImages} processingUrls={processingUrls} onStandardizeAll={async () => {
               setIsProcessingImages(true);
               const mainUrl = localListing.optimized?.optimized_main_image || localListing.cleaned.main_image || "";
               const otherUrls = localListing.optimized?.optimized_other_images || localListing.cleaned.other_images || [];
               
               const processedMain = mainUrl ? await processAndUploadImage(mainUrl) : "";
               const processedOthers = [];
               for (const u of otherUrls) {
                 processedOthers.push(await processAndUploadImage(u));
               }

               const next = JSON.parse(JSON.stringify(localListing)) as Listing;
               next.optimized = { 
                 ...(next.optimized || {}), 
                 optimized_main_image: processedMain || next.optimized?.optimized_main_image, 
                 optimized_other_images: processedOthers 
               } as OptimizedData;
               
               setLocalListing(next); onUpdate(next); await syncToSupabase(next); setIsProcessingImages(false);
               if (processedMain) setPreviewImage(processedMain);
             }} onStandardizeOne={async (url) => {
               const newUrl = await processAndUploadImage(url);
               const next = JSON.parse(JSON.stringify(localListing)) as Listing;
               if ((next.optimized?.optimized_main_image || next.cleaned.main_image) === url) {
                 next.optimized = { ...(next.optimized || {}), optimized_main_image: newUrl } as OptimizedData;
               } else { 
                 const others = [...(next.optimized?.optimized_other_images || next.cleaned.other_images || [])]; 
                 const idx = others.indexOf(url); if (idx > -1) { others[idx] = newUrl; next.optimized = { ...(next.optimized || {}), optimized_other_images: others } as OptimizedData; } 
               }
               setLocalListing(next); onUpdate(next); await syncToSupabase(next); setPreviewImage(newUrl);
             }} onRestoreAll={() => {
                const next = JSON.parse(JSON.stringify(localListing));
                if (next.optimized) { delete next.optimized.optimized_main_image; delete next.optimized.optimized_other_images; }
                setLocalListing(next); setPreviewImage(next.cleaned.main_image || ''); onUpdate(next); syncToSupabase(next);
             }} setShowEditor={(show) => { 
                if (show) setEditingImageUrl(previewImage); 
                setShowImageEditor(show); 
             }} fileInputRef={fileInputRef} onAddImage={handleFileUpload} />
             <ListingSourcingSection listing={localListing} updateField={(f, v) => updateFields({[f]: v}, true)} setShowModal={setShowSourcingModal} setShowForm={setShowSourcingForm} setEditingRecord={setEditingSourceRecord} />
          </div>
          
          <div className="lg:col-span-8 space-y-6">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 bg-slate-50/50 flex flex-wrap gap-2 border-b border-slate-100 items-center justify-between">
                   <div className="flex flex-wrap gap-1.5 flex-1">
                     <button onClick={() => setActiveMarket('US')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>🇺🇸 Master</button>
                     {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => {
                        const isTranslated = !!localListing.translations?.[m.code];
                        return (
                          <button key={m.code} onClick={() => { setActiveMarket(m.code); if (!isTranslated) translateSite(m.code); }} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeMarket === m.code ? 'bg-indigo-600 text-white shadow-md' : isTranslated ? 'bg-white text-slate-500 border border-slate-200' : 'bg-white text-slate-300 border-2 border-dashed border-slate-100 opacity-60'}`}>
                            {m.flag} {m.code}
                            {activeMarket === m.code && <RefreshCw size={10} onClick={(e) => { e.stopPropagation(); translateSite(m.code); }} className="hover:rotate-180 transition-transform" />}
                          </button>
                        );
                     })}
                   </div>
                   <button onClick={translateAllMarkets} disabled={isTranslating || !localListing.optimized} className={`px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl shadow-indigo-100 transition-all ${isTranslating ? 'animate-pulse opacity-80' : 'hover:scale-105 active:scale-95'}`}>
                      {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isTranslating ? `Translating ${translateStatus.current}/${translateStatus.total}` : 'Translate All'}
                   </button>
                </div>
                <ListingEditorArea listing={localListing} activeMarket={activeMarket} updateField={(f, v) => updateFields({[f]: v})} onSync={() => syncToSupabase(localListing)} onRecalculate={() => updateFields(calculateMarketLogistics(localListing, activeMarket), true)} uiLang={uiLang} />
             </div>
          </div>
        </div>
      </div>

      {showImageEditor && (
        <ImageEditor imageUrl={editingImageUrl} onClose={() => setShowImageEditor(false)} onSave={(url) => {
          const next = JSON.parse(JSON.stringify(localListing));
          if ((next.optimized?.optimized_main_image || next.cleaned.main_image) === editingImageUrl) next.optimized = { ...(next.optimized || {}), optimized_main_image: url };
          else { const others = [...(next.optimized?.optimized_other_images || next.cleaned.other_images || [])]; const idx = others.indexOf(editingImageUrl); if (idx > -1) { others[idx] = url; next.optimized = { ...(next.optimized || {}), optimized_other_images: others }; } }
          setPreviewImage(url); setLocalListing(next); onUpdate(next); syncToSupabase(next); setShowImageEditor(false);
        }} uiLang={uiLang} />
      )}
      
      {showSourcingModal && <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={(rec) => { updateFields({ sourcing_data: [...(localListing.sourcing_data || []), rec] }, true); setShowSourcingModal(false); }} />}
      {showSourcingForm && <SourcingFormModal initialData={editingSourceRecord} onClose={() => setShowSourcingForm(false)} onSave={(rec) => { const cur = localListing.sourcing_data || []; const next = editingSourceRecord ? cur.map(s => s.id === editingSourceRecord.id ? rec : s) : [...cur, rec]; updateFields({ sourcing_data: next }, true); setShowSourcingForm(false); }} />}
    </div>
  );
};
