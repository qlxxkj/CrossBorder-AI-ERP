
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

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onDelete, onNext, uiLang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<'gemini' | 'openai' | 'deepseek'>(() => (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini');
  const [isOptimizing, setIsOptimizing] = useState(false);
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
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => { 
    setLocalListing(listing); 
    const effectiveMain = listing.optimized?.optimized_main_image || listing.cleaned?.main_image || '';
    setPreviewImage(effectiveMain); 
    fetchExchangeRates(); 
  }, [listing.id]);

  const fetchExchangeRates = async () => {
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
    } catch (e) {
      console.error("Database sync failed:", e);
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

  const updateField = (field: string, value: any, shouldSync: boolean = false) => {
    updateFields({ [field]: value }, shouldSync);
  };

  // 标准化核心：1600x1600 + 白色背景 + 1500px 居中
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
          
          // 1. 填充白色背景
          ctx.fillStyle = '#FFFFFF'; 
          ctx.fillRect(0, 0, 1600, 1600);
          
          // 2. 缩放逻辑：最长边 1500px
          const scale = Math.min(1500 / img.width, 1500 / img.height);
          const dW = img.width * scale;
          const dH = img.height * scale;
          
          // 3. 居中计算
          const oX = (1600 - dW) / 2;
          const oY = (1600 - dH) / 2;
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, oX, oY, dW, dH);
          
          canvas.toBlob(async (blob) => {
            if (!blob) return resolve(imgUrl);
            const fd = new FormData();
            fd.append('file', blob, `std_${Date.now()}.jpg`);
            try {
              const res = await fetch(TARGET_API, { method: 'POST', body: fd });
              if (!res.ok) throw new Error("Upload Error");
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
        const others = [...(nextListing.optimized?.optimized_other_images || nextListing.cleaned.other_images || [])];
        const idx = others.indexOf(url);
        if (idx > -1) {
          others[idx] = newUrl;
          nextListing.optimized = { ...(nextListing.optimized || {}), optimized_other_images: others };
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
    const m = localListing.optimized?.optimized_main_image || localListing.cleaned.main_image || "";
    const o = localListing.optimized?.optimized_other_images || localListing.cleaned.other_images || [];
    const all = [m, ...o].filter(Boolean) as string[];
    all.forEach(u => setProcessingUrls(prev => new Set(prev).add(u)));
    
    try {
      const results = await Promise.all([
        m ? processAndUploadImage(m) : Promise.resolve(""),
        ...o.map(u => processAndUploadImage(u))
      ]);
      
      const newMain = results[0];
      const newOthers = results.slice(1).filter(Boolean);
      
      const next = JSON.parse(JSON.stringify(localListing));
      next.optimized = { 
        ...(next.optimized || {}), 
        optimized_main_image: newMain || next.optimized?.optimized_main_image,
        optimized_other_images: newOthers
      };
      
      if (previewImage === m && newMain) setPreviewImage(newMain);
      setLocalListing(next);
      onUpdate(next);
      await syncToSupabase(next);
    } finally {
      setIsProcessingImages(false);
      setProcessingUrls(new Set());
    }
  };

  const handleAIEditSave = (newUrl: string) => {
    const next = JSON.parse(JSON.stringify(localListing));
    const currentMain = next.optimized?.optimized_main_image || next.cleaned.main_image;
    
    if (currentMain === editingImageUrl) {
      next.optimized = { ...(next.optimized || {}), optimized_main_image: newUrl };
    } else {
      const others = [...(next.optimized?.optimized_other_images || next.cleaned.other_images || [])];
      const idx = others.indexOf(editingImageUrl);
      if (idx > -1) {
        others[idx] = newUrl;
        next.optimized = { ...(next.optimized || {}), optimized_other_images: others };
      }
    }
    
    setPreviewImage(newUrl);
    setLocalListing(next);
    onUpdate(next);
    syncToSupabase(next);
    setShowImageEditor(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar 
        onBack={onBack} engine={engine} setEngine={setEngine} 
        onOptimize={async () => {
          setIsOptimizing(true);
          try {
            let opt: OptimizedData;
            if (engine === 'openai') opt = await optimizeListingWithOpenAI(localListing.cleaned);
            else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(localListing.cleaned);
            else opt = await optimizeListingWithAI(localListing.cleaned);
            
            const next = { ...localListing, optimized: { ...opt, optimized_main_image: localListing.optimized?.optimized_main_image, optimized_other_images: localListing.optimized?.optimized_other_images }, status: 'optimized' as const };
            setLocalListing(next); onUpdate(next); await syncToSupabase(next);
          } finally { setIsOptimizing(false); }
        }} 
        isOptimizing={isOptimizing} 
        onSave={() => syncToSupabase(localListing)} 
        onDelete={() => onDelete(localListing.id)} 
        isSaving={isSaving} onNext={onNext} uiLang={uiLang} 
      />
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection 
               listing={localListing} previewImage={previewImage} setPreviewImage={setPreviewImage} 
               updateField={(f, v) => updateField(f, v, true)} 
               updateFields={(fs) => updateFields(fs, true)} 
               isSaving={isSaving} isProcessing={isProcessingImages} 
               processingUrls={processingUrls} 
               onStandardizeAll={handleStandardizeAll} 
               onStandardizeOne={handleStandardizeOne} 
               onRestoreAll={() => {
                 const next = JSON.parse(JSON.stringify(localListing));
                 if (next.optimized) { delete next.optimized.optimized_main_image; delete next.optimized.optimized_other_images; }
                 setLocalListing(next); setPreviewImage(next.cleaned.main_image || ''); onUpdate(next); syncToSupabase(next);
               }} 
               setShowEditor={(show) => { if (show) setEditingImageUrl(previewImage); setShowImageEditor(show); }} 
               fileInputRef={fileInputRef} 
             />
             <ListingSourcingSection listing={localListing} updateField={(f, v) => updateField(f, v, true)} setShowModal={setShowSourcingModal} setShowForm={setShowSourcingForm} setEditingRecord={setEditingSourceRecord} />
          </div>
          <div className="lg:col-span-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-wrap items-center justify-between gap-6">
                   <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                      <button onClick={() => setActiveMarket('US')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>🇺🇸 Master</button>
                      {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => (
                         <button key={m.code} onClick={() => setActiveMarket(m.code)} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === m.code ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}>{m.flag} {m.code}</button>
                      ))}
                   </div>
                </div>
                <ListingEditorArea listing={localListing} activeMarket={activeMarket} updateField={updateField} onSync={() => syncToSupabase(localListing)} onRecalculate={() => {}} uiLang={uiLang} />
             </div>
          </div>
        </div>
      </div>
      {showImageEditor && <ImageEditor imageUrl={editingImageUrl} onClose={() => setShowImageEditor(false)} onSave={handleAIEditSave} uiLang={uiLang} />}
    </div>
  );
};
