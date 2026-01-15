
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  BrainCircuit, Globe, Languages, Loader2, DollarSign, Truck, Settings2, ZoomIn, Save, ChevronRight,
  Zap, Check, AlertCircle, Weight, Ruler, Coins, ListFilter, FileText, Wand2, Star, Upload, Search, ExternalLink, Link2, Maximize2
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, PriceAdjustment, ExchangeRate, SourcingRecord } from '../types';
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

// 换算常量
const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

// 工具函数：安全数字格式化
const formatNum = (val: any) => {
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? '0' : parseFloat(n.toFixed(2)).toString();
};

// 站点单位全称配置
const MKT_UNITS: Record<string, { w: string, s: string }> = {
  'US': { w: 'pounds', s: 'inches' },
  'CA': { w: 'pounds', s: 'inches' },
  'UK': { w: 'Kilograms', s: 'Centimetres' },
  'DE': { w: 'Kilogramm', s: 'Zentimeter' },
  'FR': { w: 'Kilogrammes', s: 'Centimètres' },
  'IT': { w: 'Chilogrammi', s: 'Centimetri' },
  'ES': { w: 'Kilogramos', s: 'Centímetros' },
  'JP': { w: 'キログラム', s: 'センチメートル' },
  'MX': { w: 'Kilogramos', s: 'Centímetros' },
  'BR': { w: 'Quilogramas', s: 'Centímetros' },
  'CN': { w: '千克', s: '厘米' },
  'default': { w: 'Kilograms', s: 'Centimeters' }
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
  const editorRef = useRef<HTMLDivElement>(null);
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSourcingModalOpen, setIsSourcingModalOpen] = useState(false);
  const [isProcessingAllImages, setIsProcessingAllImages] = useState(false);
  
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [selectedImage, setSelectedImage] = useState<string>(listing.cleaned?.main_image || '');
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [editorLeft, setEditorLeft] = useState<number>(0);
  const [activeMarketplace, setActiveMarketplace] = useState<string>('US'); 

  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    fetchPricingData();
    updateEditorPosition();
    window.addEventListener('resize', updateEditorPosition);
    return () => window.removeEventListener('resize', updateEditorPosition);
  }, []);

  const updateEditorPosition = () => {
    if (editorRef.current) {
      setEditorLeft(editorRef.current.getBoundingClientRect().left);
    }
  };

  const fetchPricingData = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('exchange_rates').select('*');
    if (data) setExchangeRates(data);
  };

  const listingRef = useRef<Listing>(localListing);
  useEffect(() => { listingRef.current = localListing; }, [localListing]);

  useEffect(() => {
    setLocalListing(listing);
    setSelectedImage(listing.cleaned?.main_image || '');
    setActiveMarketplace('US');
    setLastSaved(null);
  }, [listing.id]);

  const currentContent = useMemo(() => {
    if (activeMarketplace === 'US') return localListing.optimized || null;
    return localListing.translations?.[activeMarketplace] || null;
  }, [localListing, activeMarketplace]);

  const targetMktConfig = useMemo(() => 
    AMAZON_MARKETPLACES.find(m => m.code === activeMarketplace) || AMAZON_MARKETPLACES[0]
  , [activeMarketplace]);

  const allImages = useMemo(() => {
    const main = localListing.cleaned.main_image;
    const others = localListing.cleaned.other_images || [];
    const uniqueList: string[] = [];
    if (main) uniqueList.push(main);
    
    others.forEach(u => {
      if (u && u !== main && !uniqueList.includes(u)) {
        uniqueList.push(u);
      }
    });
    return uniqueList;
  }, [localListing.cleaned.main_image, localListing.cleaned.other_images]);

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

  const generateLogisticsData = (mktCode: string): Partial<OptimizedData> => {
    const config = MKT_UNITS[mktCode] || MKT_UNITS.default;
    const isImperial = ['US', 'CA'].includes(mktCode);
    const usOpt = localListing.optimized;
    const clean = localListing.cleaned;

    const baseWeight = parseFloat(usOpt?.optimized_weight_value || String(clean.item_weight_value || clean.item_weight || '0').replace(/[^0-9.]/g, '')) || 0;
    const baseL = parseFloat(usOpt?.optimized_length || String(clean.item_length || '0')) || 0;
    const baseW = parseFloat(usOpt?.optimized_width || String(clean.item_width || '0')) || 0;
    const baseH = parseFloat(usOpt?.optimized_height || String(clean.item_height || '0')) || 0;

    if (isImperial) {
      return {
        optimized_weight_value: formatNum(baseWeight),
        optimized_weight_unit: config.w,
        optimized_length: formatNum(baseL),
        optimized_width: formatNum(baseW),
        optimized_height: formatNum(baseH),
        optimized_size_unit: config.s
      };
    } else {
      return {
        optimized_weight_value: formatNum(baseWeight * LB_TO_KG),
        optimized_weight_unit: config.w,
        optimized_length: formatNum(baseL * IN_TO_CM),
        optimized_width: formatNum(baseW * IN_TO_CM),
        optimized_height: formatNum(baseH * IN_TO_CM),
        optimized_size_unit: config.s
      };
    }
  };

  const syncToSupabase = async (targetListing: Listing) => {
    if (!isSupabaseConfigured()) return;
    setIsSaving(true);
    try {
      const payload = {
        cleaned: targetListing.cleaned,
        optimized: targetListing.optimized || null,
        translations: targetListing.translations || null,
        status: targetListing.status,
        sourcing_data: targetListing.sourcing_data || [],
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('listings').update(payload).eq('id', targetListing.id);
      if (error) throw error;
      onUpdate({ ...targetListing, updated_at: new Date().toISOString() });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e: any) { 
      console.error("Save failed:", e);
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleSaveAndNext = async () => { await syncToSupabase(localListing); onNext(); };

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
    } catch (e: any) { alert("Optimization failed: " + e.message); } 
    finally { setIsOptimizing(false); }
  };

  const processTranslation = async (mktCode: string): Promise<OptimizedData> => {
    if (!localListing.optimized) throw new Error("Base listing not optimized yet.");
    const mkt = AMAZON_MARKETPLACES.find(m => m.code === mktCode);
    const targetLang = mktCode === 'CA' ? 'English' : (mkt?.name || 'English');
    const aiTextData = aiProvider === 'gemini'
      ? await translateListingWithAI(localListing.optimized, targetLang)
      : await translateListingWithOpenAI(localListing.optimized, targetLang);
    const logisticsData = generateLogisticsData(mktCode);
    return { ...localListing.optimized, ...aiTextData, ...logisticsData } as OptimizedData;
  };

  const handleTranslate = async (mktCode: string) => {
    setIsTranslating(mktCode);
    try {
      const finalData = await processTranslation(mktCode);
      const updated = { ...localListing, translations: { ...(localListing.translations || {}), [mktCode]: finalData } };
      setLocalListing(updated);
      await syncToSupabase(updated);
      setActiveMarketplace(mktCode);
    } catch (e: any) { alert(`Translation for ${mktCode} failed: ` + e.message); } 
    finally { setIsTranslating(null); }
  };

  const handleTranslateAll = async () => {
    if (!localListing.optimized) { alert("Optimize base content first."); return; }
    setIsTranslatingAll(true);
    try {
      const newTranslations = { ...(localListing.translations || {}) };
      for (const mkt of AMAZON_MARKETPLACES) {
        if (mkt.code === 'US') continue;
        setIsTranslating(mkt.code);
        try { newTranslations[mkt.code] = await processTranslation(mkt.code); } 
        catch (mktErr) { console.error(`Skipping ${mkt.code}:`, mktErr); }
      }
      const updated = { ...localListing, translations: newTranslations };
      setLocalListing(updated);
      await syncToSupabase(updated);
      setIsTranslating(null);
    } catch (e: any) { alert("Batch translation error: " + e.message); } 
    finally { setIsTranslatingAll(false); }
  };

  const handleStandardizeAllImages = async () => {
    if (!confirm(uiLang === 'zh' ? "确定要将所有图片标准化为 1600x1600 吗？" : "Standardize all images to 1600x1600?")) return;
    setIsProcessingAllImages(true);
    try {
      const urls = allImages;
      const newUrls: string[] = [];
      
      for (const url of urls) {
        const processedDataUrl = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = `${CORS_PROXY}${encodeURIComponent(url)}`;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const targetSize = 1600;
            const safeArea = 1500;
            canvas.width = targetSize;
            canvas.height = targetSize;
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, targetSize, targetSize);
              const scale = Math.min(safeArea / img.width, safeArea / img.height);
              const drawW = img.width * scale;
              const drawH = img.height * scale;
              ctx.drawImage(img, (targetSize - drawW) / 2, (targetSize - drawH) / 2, drawW, drawH);
              resolve(canvas.toDataURL('image/jpeg', 0.9));
            }
          };
          img.onerror = () => reject(new Error("Image load failed"));
        });

        const byteString = atob(processedDataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('file', new File([blob], 'standard.jpg', { type: 'image/jpeg' }));
        const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formData });
        const data = await res.json();
        const newUrl = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
        newUrls.push(newUrl);
      }

      const updated = { 
        ...localListing, 
        cleaned: { 
          ...localListing.cleaned, 
          main_image: newUrls[0], 
          other_images: newUrls.slice(1) 
        } 
      };
      setLocalListing(updated);
      setSelectedImage(newUrls[0]);
      await syncToSupabase(updated);
    } catch (e: any) {
      alert("Batch standardization failed: " + e.message);
    } finally {
      setIsProcessingAllImages(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Upload fail");
      const data = await res.json();
      const url = Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
      const newOthers = [...(localListing.cleaned.other_images || []), url];
      const updated = { ...localListing, cleaned: { ...localListing.cleaned, other_images: newOthers } };
      setLocalListing(updated);
      setSelectedImage(url);
      await syncToSupabase(updated);
    } catch (err: any) { alert("Upload failed: " + err.message); } 
    finally { setIsUploading(false); if (e.target) e.target.value = ''; }
  };

  const handleDeleteImage = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (url === localListing.cleaned.main_image) { alert("Cannot delete main image directly."); return; }
    const nextOthers = (localListing.cleaned.other_images || []).filter(u => u !== url);
    const updated = { ...localListing, cleaned: { ...localListing.cleaned, other_images: nextOthers } };
    setLocalListing(updated);
    if (selectedImage === url) setSelectedImage(localListing.cleaned.main_image);
    await syncToSupabase(updated);
  };

  const handleSetMain = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const oldMain = localListing.cleaned.main_image;
    const others = (localListing.cleaned.other_images || []).filter(u => u !== url);
    const nextOthers = [...others, oldMain];
    const updated = { ...localListing, cleaned: { ...localListing.cleaned, main_image: url, other_images: nextOthers } };
    setLocalListing(updated);
    await syncToSupabase(updated);
  };

  const handleAIImageUpdate = async (dataUrl: string) => {
    setIsEditorOpen(false);
    setIsUploading(true);
    try {
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', new File([blob], 'ai-optimized.jpg', { type: 'image/jpeg' }));
      const uploadRes = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      const newUrl = Array.isArray(uploadData) && uploadData[0]?.src ? `${IMAGE_HOST_DOMAIN}${uploadData[0].src}` : uploadData.url;
      let updated;
      if (selectedImage === localListing.cleaned.main_image) {
        updated = { ...localListing, cleaned: { ...localListing.cleaned, main_image: newUrl } };
      } else {
        const others = (localListing.cleaned.other_images || []).map(u => u === selectedImage ? newUrl : u);
        updated = { ...localListing, cleaned: { ...localListing.cleaned, other_images: others } };
      }
      setLocalListing(updated);
      setSelectedImage(newUrl);
      await syncToSupabase(updated);
    } catch (e: any) { alert("AI Image Save Failed: " + e.message); } 
    finally { setIsUploading(false); }
  };

  const displayVal = (field: keyof OptimizedData | string, cleanedField: string) => {
    if (activeMarketplace !== 'US' && localListing.translations?.[activeMarketplace]) {
      const val = (localListing.translations[activeMarketplace] as any)[field];
      if (val !== undefined && val !== null && val !== '') return val;
    }
    if (localListing.optimized) {
      const val = (localListing.optimized as any)[field];
      if (val !== undefined && val !== null && val !== '') return val;
    }
    return (localListing.cleaned as any)[cleanedField] || '';
  };

  const CharCounter = ({ count, limit }: { count: number, limit: number }) => (
    <span className={`text-[10px] font-black ${count > limit ? 'text-red-500' : 'text-slate-400'}`}> {count} / {limit} </span>
  );

  const handleAddSourcingRecord = (record: any) => {
    const newRecord: SourcingRecord = {
      id: record.id || Date.now().toString(),
      title: record.title || '1688 Source',
      price: record.price || '-',
      image: record.image || '',
      url: record.link || record.url
    };
    const next = [...(localListing.sourcing_data || []), newRecord];
    const updated = { ...localListing, sourcing_data: next };
    setLocalListing(updated);
    syncToSupabase(updated);
    setIsSourcingModalOpen(false);
  };

  const handleRemoveSourcing = (id: string) => {
    const next = (localListing.sourcing_data || []).filter(r => r.id !== id);
    const updated = { ...localListing, sourcing_data: next };
    setLocalListing(updated);
    syncToSupabase(updated);
  };

  if (!listing || !listing.cleaned) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900 font-inter animate-in fade-in duration-500 pb-20 relative">
      {isEditorOpen && <ImageEditor imageUrl={selectedImage} onClose={() => setIsEditorOpen(false)} onSave={handleAIImageUpdate} />}
      {isSourcingModalOpen && <SourcingModal productImage={localListing.cleaned.main_image} onClose={() => setIsSourcingModalOpen(false)} onAddLink={handleAddSourcingRecord} />}
      
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-4 z-40">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-black text-sm uppercase tracking-widest">
            <ArrowLeft size={18} className="mr-2" /> {t('back')}
          </button> 
          {lastSaved && <div className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase bg-green-50 px-3 py-1 rounded-full border border-green-100"><Check size={12} /> Auto-saved @ {lastSaved}</div>}
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setAiProvider('gemini')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${aiProvider === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Gemini</button>
            <button onClick={() => setAiProvider('openai')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${aiProvider === 'openai' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>GPT-4o</button>
          </div>
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all uppercase">{isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} AI Optimize</button>
          <button onClick={handleSaveAndNext} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all uppercase">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {t('saveAndNext')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="space-y-6 lg:sticky lg:top-24">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-6">
            <h3 className="font-black text-slate-900 flex items-center justify-between text-xs uppercase tracking-widest">
              <span className="flex items-center gap-2"><ImageIcon size={16} className="text-blue-500" /> Media Studio</span>
              <div className="flex gap-1">
                <button 
                  onClick={handleStandardizeAllImages} 
                  disabled={isProcessingAllImages}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Standardize All to 1600x1600"
                >
                  {isProcessingAllImages ? <Loader2 size={14} className="animate-spin" /> : <Maximize2 size={14} />}
                </button>
                {isUploading && <Loader2 className="animate-spin text-blue-500" size={14} />}
              </div>
            </h3>
            
            <div className="relative aspect-square rounded-[2rem] bg-slate-50 border border-slate-100 overflow-hidden shadow-inner group">
              <img src={selectedImage} className="w-full h-full object-contain" alt="Main" />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm gap-3">
                 <button onClick={() => setIsEditorOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transform hover:scale-105 active:scale-95 transition-all">
                   <Wand2 size={16} /> AI Lab
                 </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gallery ({allImages.length})</span>
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Upload size={14} /></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {allImages.map((url, i) => (
                  <div key={url} onClick={() => setSelectedImage(url)} className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${selectedImage === url ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-slate-100 hover:border-slate-300'}`}>
                    <img src={url} className="w-full h-full object-cover" alt={`Thumb ${i}`} />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1">
                      {url !== localListing.cleaned.main_image && <button onClick={(e) => handleSetMain(url, e)} className="p-1 bg-amber-500 text-white rounded shadow-md hover:bg-amber-600"><Star size={10} /></button>}
                      <button onClick={(e) => handleDeleteImage(url, e)} className="p-1 bg-red-500 text-white rounded shadow-md hover:bg-red-600"><Trash2 size={10} /></button>
                    </div>
                  </div>
                ))}
                {allImages.length < 9 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-all"><Plus size={20} /></button>}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-6">
            <h3 className="font-black text-slate-900 flex items-center justify-between text-xs uppercase tracking-widest">
              <span className="flex items-center gap-2"><Link2 size={16} className="text-orange-500" /> Sourcing</span>
              <button onClick={() => setIsSourcingModalOpen(true)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"><Search size={14} /></button>
            </h3>
            <div className="space-y-3">
              {(localListing.sourcing_data || []).map((record) => (
                <div key={record.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 group relative hover:border-orange-200 transition-all">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-lg overflow-hidden shrink-0">
                    {record.image ? <img src={record.image} className="w-full h-full object-cover" /> : <Link2 size={14} className="text-slate-300 m-3" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black text-slate-800 truncate">{record.title}</p>
                    <p className="text-[9px] font-bold text-orange-600 uppercase">{record.price}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={record.url} target="_blank" className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600"><ExternalLink size={12} /></a>
                    <button onClick={() => handleRemoveSourcing(record.id)} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
              {(!localListing.sourcing_data || localListing.sourcing_data.length === 0) && (
                <div className="p-6 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No Sources Linked</p>
                  <button onClick={() => setIsSourcingModalOpen(true)} className="mt-2 text-[9px] font-black text-orange-500 hover:underline uppercase">Visual Search 1688</button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 flex items-center gap-2 text-xs uppercase tracking-widest"><Languages size={16} className="text-purple-500" /> All Global Sites</h3>
              <button onClick={handleTranslateAll} disabled={isTranslatingAll || !localListing.optimized} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase shadow-md disabled:opacity-50">
                {isTranslatingAll ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Batch All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {AMAZON_MARKETPLACES.map(m => (
                <button key={m.code} disabled={isTranslating !== null || isTranslatingAll} onClick={() => (m.code === 'US' || localListing.translations?.[m.code]) ? setActiveMarketplace(m.code) : handleTranslate(m.code)} className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-black transition-all ${activeMarketplace === m.code ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm scale-105' : (m.code === 'US' || localListing.translations?.[m.code] ? 'border-slate-100 text-slate-600 hover:border-purple-300' : 'border-dashed border-slate-200 text-slate-400 hover:bg-slate-50')}`}>
                  <span className="flex items-center gap-2"><span>{m.flag}</span> {m.code}</span> {isTranslating === m.code && <Loader2 size={12} className="animate-spin" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div ref={editorRef} className="lg:col-span-2 space-y-6 min-h-[1200px]">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
             <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Edit2 size={14} /> Global Editor & bull; {targetMktConfig.name}</h4>
               {activeMarketplace !== 'US' && <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-100"><Coins size={12} /> Unit System & Rate Applied</div>}
             </div>
             
             <div className="p-8 border-b border-slate-100 bg-slate-50/20 space-y-8">
               <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><DollarSign size={10} /> Price ({localizedPricing.currency})</label>
                   <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300 pointer-events-none">{localizedPricing.currency}</span>
                     <input type="number" step={activeMarketplace === 'JP' ? '1' : '0.01'} value={localizedPricing.price} readOnly={activeMarketplace !== 'US'} onChange={(e) => activeMarketplace === 'US' && handleFieldChange('cleaned.price', parseFloat(e.target.value) || 0)} onBlur={handleBlur} className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-xl font-black text-slate-900 outline-none shadow-sm" />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Truck size={10} /> Shipping ({localizedPricing.currency})</label>
                   <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300 pointer-events-none">{localizedPricing.currency}</span>
                     <input type="number" step={activeMarketplace === 'JP' ? '1' : '0.01'} value={localizedPricing.shipping} readOnly={activeMarketplace !== 'US'} onChange={(e) => activeMarketplace === 'US' && handleFieldChange('cleaned.shipping', parseFloat(e.target.value) || 0)} onBlur={handleBlur} className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-xl font-black text-slate-900 outline-none shadow-sm" />
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100/50">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Weight size={10} /> Localized Weight</label>
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <input type="text" value={displayVal('optimized_weight_value', 'item_weight_value')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_weight_value' : `translations.${activeMarketplace}.optimized_weight_value`, e.target.value)} onBlur={handleBlur} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none shadow-sm" />
                      <input type="text" value={displayVal('optimized_weight_unit', 'item_weight_unit')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_weight_unit' : `translations.${activeMarketplace}.optimized_weight_unit`, e.target.value)} onBlur={handleBlur} placeholder="Unit" className="w-full px-1 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-600 outline-none text-center" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Ruler size={10} /> Localized Dimensions</label>
                    <div className="flex gap-2">
                      <input placeholder="L" value={displayVal('optimized_length', 'item_length')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_length' : `translations.${activeMarketplace}.optimized_length`, e.target.value)} onBlur={handleBlur} className="w-full px-2 py-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold shadow-sm" />
                      <input placeholder="W" value={displayVal('optimized_width', 'item_width')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_width' : `translations.${activeMarketplace}.optimized_width`, e.target.value)} onBlur={handleBlur} className="w-full px-2 py-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold shadow-sm" />
                      <input placeholder="H" value={displayVal('optimized_height', 'item_height')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_height' : `translations.${activeMarketplace}.optimized_height`, e.target.value)} onBlur={handleBlur} className="w-full px-2 py-3 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold shadow-sm" />
                      <input placeholder="Unit" value={displayVal('optimized_size_unit', 'item_size_unit')} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_size_unit' : `translations.${activeMarketplace}.optimized_size_unit`, e.target.value)} onBlur={handleBlur} className="w-24 px-1 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center text-[10px] font-black text-indigo-600 shadow-sm" />
                    </div>
                  </div>
               </div>
             </div>

             {currentContent ? (
               <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                 <div className="space-y-2">
                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Localized Title</label><CharCounter count={currentContent.optimized_title?.length || 0} limit={LIMITS.TITLE} /></div>
                    <textarea value={currentContent.optimized_title || ''} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_title' : `translations.${activeMarketplace}.optimized_title`, e.target.value)} onBlur={handleBlur} className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-base font-bold text-slate-800 outline-none min-h-[80px] leading-relaxed transition-all shadow-sm" />
                 </div>
                 
                 <div className="space-y-2">
                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Search Keywords</label><CharCounter count={currentContent.search_keywords?.length || 0} limit={LIMITS.KEYWORDS} /></div>
                    <input value={currentContent.search_keywords || ''} onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.search_keywords' : `translations.${activeMarketplace}.search_keywords`, e.target.value)} onBlur={handleBlur} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono tracking-tight text-slate-600 outline-none shadow-inner" />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl">
                          <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Bullet Points</label>
                          <button onClick={() => { 
                            const next = [...(currentContent.optimized_features || []), ""]; 
                            handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_features' : `translations.${activeMarketplace}.optimized_features`, next);
                          }} className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-lg"><Plus size={14} /></button>
                       </div>
                       <div className="space-y-4">
                          {(currentContent.optimized_features || []).map((f: string, i: number) => (
                             <div key={i} className="group relative">
                                <div className="absolute -left-3 top-4 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black z-10 shadow-lg">{i + 1}</div>
                                <textarea 
                                   value={f} 
                                   onChange={(e) => { 
                                     const next = [...currentContent.optimized_features]; 
                                     next[i] = e.target.value; 
                                     handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_features' : `translations.${activeMarketplace}.optimized_features`, next); 
                                   }}
                                   onBlur={handleBlur}
                                   className="w-full p-5 pl-7 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 min-h-[80px] shadow-sm"
                                />
                                <button onClick={() => { 
                                  const next = currentContent.optimized_features.filter((_: any, idx: number) => idx !== i); 
                                  handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_features' : `translations.${activeMarketplace}.optimized_features`, next); 
                                }} className="absolute -right-2 -top-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                             </div>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl">
                          <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> Product Description</label>
                          <CharCounter count={currentContent.optimized_description?.length || 0} limit={LIMITS.DESCRIPTION} />
                       </div>
                       <textarea 
                          value={currentContent.optimized_description || ''} 
                          onChange={(e) => handleFieldChange(activeMarketplace === 'US' ? 'optimized.optimized_description' : `translations.${activeMarketplace}.optimized_description`, e.target.value)}
                          onBlur={handleBlur}
                          className="w-full p-6 bg-white border border-slate-200 rounded-[2rem] text-xs font-medium text-slate-600 outline-none focus:border-indigo-500 min-h-[500px] leading-loose shadow-sm"
                          placeholder="HTML Content..."
                       />
                    </div>
                 </div>
               </div>
             ) : (
               <div className="p-32 text-center flex flex-col items-center justify-center gap-6 flex-1 bg-slate-50/30"><div className="w-24 h-24 bg-white rounded-[2rem] border border-slate-100 shadow-xl flex items-center justify-center text-slate-100 transform rotate-12"><BrainCircuit size={48} /></div><p className="text-slate-800 font-black text-xl tracking-tight uppercase">Ready to Optimize</p><button onClick={handleOptimize} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all">Start Engine</button></div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
