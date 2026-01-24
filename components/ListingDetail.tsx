
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

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

// 增强版 URL 归一化：用于跨环境精准比对
const normalizeUrl = (url: string | undefined): string => {
  if (!url) return "";
  let clean = url;
  
  // 1. 处理代理前缀
  if (url.includes('corsproxy.io/?')) {
    const parts = url.split('corsproxy.io/?');
    const encoded = parts[parts.length - 1];
    try {
      clean = decodeURIComponent(encoded);
    } catch(e) {
      clean = encoded;
    }
  }
  
  // 2. 移除时间戳参数和 Fragment
  clean = clean.split('?')[0].split('#')[0];
  
  // 3. 移除协议头（解决 http/https 不一致）并统一斜杠
  return clean.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
};

const standardizeImage = async (imageUrl: string): Promise<string> => {
  if (!imageUrl) return "";
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl.startsWith('http') ? `${CORS_PROXY}${encodeURIComponent(imageUrl)}` : imageUrl;
    
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const targetSize = 1600;
      const safeArea = 1500;
      canvas.width = targetSize;
      canvas.height = targetSize;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageUrl); return; }
      
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetSize, targetSize);
      
      const scale = Math.min(safeArea / img.width, safeArea / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (targetSize - drawW) / 2;
      const offsetY = (targetSize - drawH) / 2;
      
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve(imageUrl); return; }
        
        try {
          const file = new File([blob], `std_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const fd = new FormData();
          fd.append('file', file);
          
          const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd });
          const data = await res.json();
          const u = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
          resolve(u || imageUrl);
        } catch (e) {
          resolve(imageUrl);
        }
      }, 'image/jpeg', 0.9);
    };
    
    img.onerror = () => resolve(imageUrl);
  });
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

  // 核心修复：仅在切换 ASIN (产品 ID) 时重置预览图
  // 防止在保存编辑后，预览图被 useEffect 强制切回旧的主图
  useEffect(() => {
    setLocalListing(listing);
    fetchPricingData();
  }, [listing.id]); 

  // 当外部强制更新 listing 时同步本地状态，但不重置预览
  useEffect(() => {
    setLocalListing(listing);
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
      
      if (error) console.error("Database sync failed:", error.message);
    } catch (e) {
      console.error("Critical sync error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: any, shouldSync: boolean = false) => {
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
      if (shouldSync) syncToSupabase(next);
      return next;
    });
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
      
      const logistics = calculateMarketLogistics(localListing, code);
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
      console.error(`Translation error for ${code}:`, e);
    } finally {
      setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(code); return n; });
    }
  };

  const handleTranslateAll = async () => {
    setIsTranslatingAll(true);
    const targets = AMAZON_MARKETPLACES.filter(m => m.code !== 'US');
    for (const m of targets) {
      await translateMarket(m.code);
      await new Promise(r => setTimeout(r, 600));
    }
    setIsTranslatingAll(false);
    await syncToSupabase(localListing);
  };

  const handleRecalculateCurrent = async () => {
    if (activeMarket === 'US') return;
    const results = calculateMarketLogistics(localListing, activeMarket);
    const next = { ...localListing };
    const trans = { ...(next.translations || {}) };
    trans[activeMarket] = { ...(trans[activeMarket] || {}), ...results } as OptimizedData;
    next.translations = trans;
    setLocalListing(next);
    onUpdate(next);
    await syncToSupabase(next);
  };

  const handleOptimizeMaster = async () => {
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

  // 深度修复：处理图片编辑器保存
  const handleImageEditorSave = async (newUrl: string) => {
    setIsSaving(true);
    
    // 1. 使用 Cache Buster 确保 UI 强制刷新（即使 URL 看起来一样）
    const finalUrl = newUrl.includes('?') ? `${newUrl}&t=${Date.now()}` : `${newUrl}?t=${Date.now()}`;
    
    // 2. 准备最新的 listing 副本
    const next = { ...localListing, cleaned: { ...localListing.cleaned } };
    
    // 3. 彻底归一化 URL 以进行精准位置匹配
    const targetNorm = normalizeUrl(previewImage);
    const mainNorm = normalizeUrl(next.cleaned.main_image);
    
    let changed = false;
    if (targetNorm === mainNorm) {
      next.cleaned.main_image = finalUrl;
      changed = true;
    } else {
      const others = [...(next.cleaned.other_images || [])];
      const idx = others.findIndex(u => normalizeUrl(u) === targetNorm);
      if (idx !== -1) {
        others[idx] = finalUrl;
        next.cleaned.other_images = others;
        changed = true;
      }
    }

    if (changed) {
      // 4. 原子更新状态
      setPreviewImage(finalUrl);
      setLocalListing(next);
      onUpdate(next);
      
      // 5. 延迟异步同步，确保状态已提交
      await syncToSupabase(next);
    }

    setIsSaving(false);
    setShowImageEditor(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar onBack={onBack} engine={engine} setEngine={(e) => { setEngine(e); localStorage.setItem('amzbot_preferred_engine', e); }} onOptimize={handleOptimizeMaster} isOptimizing={isOptimizing} onSave={() => syncToSupabase(localListing)} isSaving={isSaving} onNext={onNext} uiLang={uiLang} />
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection 
              listing={localListing} 
              previewImage={previewImage} 
              setPreviewImage={setPreviewImage} 
              updateField={(f, v) => updateField(f, v, true)} 
              isSaving={isSaving} 
              isProcessing={isProcessingImages} 
              onStandardizeAll={async () => { 
                setIsProcessingImages(true); 
                const newMain = await standardizeImage(localListing.cleaned.main_image || ''); 
                const newOthers = await Promise.all((localListing.cleaned.other_images || []).map(u => standardizeImage(u))); 
                const next = { ...localListing, cleaned: { ...localListing.cleaned, main_image: newMain, other_images: newOthers } };
                setLocalListing(next); onUpdate(next); syncToSupabase(next);
                setPreviewImage(newMain); setIsProcessingImages(false); 
              }} 
              onStandardizeOne={async (u) => {
                setIsProcessingImages(true);
                const n = await standardizeImage(u);
                const next = { ...localListing, cleaned: { ...localListing.cleaned } };
                const uNorm = normalizeUrl(u);
                if(uNorm === normalizeUrl(next.cleaned.main_image)) { 
                  next.cleaned.main_image = n; 
                  setPreviewImage(n); 
                } else { 
                  next.cleaned.other_images = (next.cleaned.other_images || []).map(x => normalizeUrl(x) === uNorm ? n : x); 
                }
                setLocalListing(next); onUpdate(next); await syncToSupabase(next);
                setIsProcessingImages(false);
              }} 
              setShowEditor={setShowImageEditor} 
              fileInputRef={fileInputRef} 
             />
             <ListingSourcingSection listing={localListing} updateField={(f, v) => updateField(f, v, true)} setShowModal={setShowSourcingModal} setShowForm={setShowSourcingForm} setEditingRecord={setEditingSourceRecord} />
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
                                className={`px-2.5 py-2.5 rounded-r-xl border-y-2 border-r-2 transition-all ${activeMarket === m.code ? 'bg-indigo-700 text-white border-indigo-600 hover:bg-indigo-800' : 'bg-slate-50 text-slate-400 border-slate-100 hover:text-indigo-600'}`}
                                title="Force Refresh Translation"
                               >
                                 <RefreshCw size={11} className={isTranslating ? 'animate-spin' : ''} />
                               </button>
                             )}
                          </div>
                        );
                      })}
                   </div>
                   <button onClick={handleTranslateAll} disabled={isTranslatingAll} className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0">
                     {isTranslatingAll ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} AI Translate All
                   </button>
                </div>
                <ListingEditorArea listing={localListing} activeMarket={activeMarket} updateField={updateField} onSync={() => syncToSupabase(localListing)} onRecalculate={handleRecalculateCurrent} uiLang={uiLang} />
             </div>
          </div>
        </div>
      </div>
      {showSourcingModal && <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={res => { const n = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] }; setLocalListing(n); updateField('sourcing_data', n.sourcing_data, true); setShowSourcingModal(false); }} />}
      {showSourcingForm && <SourcingFormModal initialData={editingSourceRecord} onClose={() => setShowSourcingForm(false)} onSave={record => { let data = [...(localListing.sourcing_data || [])]; if (editingSourceRecord) data = data.map(s => s.id === record.id ? record : s); else data.push(record); updateField('sourcing_data', data, true); setShowSourcingForm(false); }} />}
      {showImageEditor && (
        <ImageEditor 
          imageUrl={previewImage} 
          onClose={() => setShowImageEditor(false)} 
          onSave={handleImageEditorSave} 
          uiLang={uiLang} 
        />
      )}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => { 
        const file = e.target.files?.[0]; if (!file) return; 
        setIsSaving(true); 
        const fd = new FormData(); fd.append('file', file); 
        try {
          const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: fd }); 
          const data = await res.json(); 
          const u = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url; 
          if (u) {
            const next = { ...localListing, cleaned: { ...localListing.cleaned, other_images: [...(localListing.cleaned.other_images || []), u] } };
            setLocalListing(next); setPreviewImage(u); onUpdate(next); await syncToSupabase(next);
          }
        } catch(err) {} finally { setIsSaving(false); }
      }} />
    </div>
  );
};
