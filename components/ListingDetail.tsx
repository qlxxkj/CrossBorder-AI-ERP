
import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  BrainCircuit, Globe, Languages, Loader2, DollarSign, Truck, Settings2, ZoomIn, Save, ChevronRight,
  Zap, Check, AlertCircle
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI } from '../services/openaiService';
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
  
  if (!listing || !listing.cleaned) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <AlertCircle size={48} className="text-red-500" />
        <h3 className="text-xl font-black text-slate-800">Data Error</h3>
        <p className="text-slate-400 max-w-sm">Unable to load listing details.</p>
        <button onClick={onBack} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold">Return</button>
      </div>
    );
  }

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
  const [activeMarketplace, setActiveMarketplace] = useState<string>('en');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const listingRef = useRef<Listing>(localListing);
  useEffect(() => { listingRef.current = localListing; }, [localListing]);

  useEffect(() => {
    setLocalListing(listing);
    setSelectedImage(listing.cleaned?.main_image || '');
    setActiveMarketplace('en');
    setLastSaved(null);
  }, [listing.id]);

  const currentContent = activeMarketplace === 'en' 
    ? (localListing.optimized || null)
    : (localListing.translations?.[activeMarketplace] || null);

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

  const handleManualSave = () => syncToSupabase(localListing);
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
    if (!response.ok) throw new Error(`Upload failed`);
    const data = await response.json();
    return Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
  };

  const allImages = [localListing.cleaned?.main_image || '', ...(localListing.cleaned?.other_images || [])].filter(img => img !== '');

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const newImages = [...allImages];
    const item = newImages.splice(draggedIdx, 1)[0];
    newImages.splice(targetIdx, 0, item);
    const updated = { ...localListing };
    if (!updated.cleaned) return;
    updated.cleaned.main_image = newImages[0];
    updated.cleaned.other_images = newImages.slice(1);
    setLocalListing(updated);
    syncToSupabase(updated);
    setDraggedIdx(null);
  };

  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLocal(true);
    try {
      const uploadedUrl = await uploadToHost(file);
      const updated = { ...localListing };
      if (!updated.cleaned) throw new Error("Missing data");
      if (!updated.cleaned.other_images) updated.cleaned.other_images = [];
      updated.cleaned.other_images.push(uploadedUrl);
      setLocalListing(updated);
      syncToSupabase(updated);
      setSelectedImage(uploadedUrl); 
    } catch (error: any) { alert(`Upload failed: ${error.message}`); } finally { setIsUploadingLocal(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDeleteImage = (img: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete image?")) return;
    const updated = { ...localListing };
    if (!updated.cleaned) return;
    if (img === updated.cleaned.main_image) {
      if (updated.cleaned.other_images?.length) {
        updated.cleaned.main_image = updated.cleaned.other_images[0];
        updated.cleaned.other_images = updated.cleaned.other_images.slice(1);
      } else { alert("Can't delete only image."); return; }
    } else { updated.cleaned.other_images = updated.cleaned.other_images?.filter(i => i !== img); }
    if (selectedImage === img) setSelectedImage(updated.cleaned.main_image);
    setLocalListing(updated);
    syncToSupabase(updated);
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
      let optimizedData = aiProvider === 'gemini' 
        ? await optimizeListingWithAI(localListing.cleaned!)
        : await optimizeListingWithOpenAI(localListing.cleaned!);
      const updated = { ...localListing, status: 'optimized' as const, optimized: optimizedData };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (error: any) { alert(`Failed: ${error.message}`); } finally { setIsOptimizing(false); }
  };

  const handleTranslate = async (mktCode: string) => {
    if (!localListing.optimized) { alert("Optimize in English first."); return; }
    setIsTranslating(mktCode);
    try {
      const mkt = AMAZON_MARKETPLACES.find(m => m.code === mktCode);
      const translated = await translateListingWithAI(localListing.optimized, mkt?.lang || 'en');
      const updated = { 
        ...localListing, 
        translations: { ...(localListing.translations || {}), [mktCode]: translated } 
      };
      setLocalListing(updated);
      await syncToSupabase(updated);
      setActiveMarketplace(mktCode);
    } catch (error: any) { alert(`Failed: ${error.message}`); } finally { setIsTranslating(null); }
  };

  const handleTranslateAll = async () => {
    if (!localListing.optimized) { alert("Optimize in English first."); return; }
    setIsTranslatingAll(true);
    try {
      const newTranslations = { ...(localListing.translations || {}) };
      for (const mkt of AMAZON_MARKETPLACES) {
        if (mkt.code === 'US' || mkt.code === 'UK') continue; // English default
        setIsTranslating(mkt.code);
        const translated = await translateListingWithAI(localListing.optimized!, mkt.lang);
        newTranslations[mkt.code] = translated;
      }
      const updated = { ...localListing, translations: newTranslations };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (error: any) { alert(`Batch translation failed: ${error.message}`); } finally { setIsTranslatingAll(false); setIsTranslating(null); }
  };

  const CharCounter = ({ count, limit }: { count: number, limit: number }) => (
    <span className={`text-[10px] font-black ${count > limit ? 'text-red-500' : 'text-slate-400'}`}> {count} / {limit} </span>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900 font-inter relative animate-in fade-in duration-500">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLocalFileSelect} />
      {hoveredImage && <div className="fixed top-1/2 right-8 -translate-y-1/2 z-[100] pointer-events-none animate-in fade-in duration-300"><div className="bg-white p-3 rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden ring-8 ring-slate-900/5"><img src={hoveredImage} className="max-w-[35vw] max-h-[75vh] object-contain rounded-2xl" alt="Preview" /></div></div>}
      {isEditorOpen && <ImageEditor imageUrl={selectedImage} onClose={() => setIsEditorOpen(false)} onSave={async (base64) => { try { const uploadedUrl = await uploadToHost(base64); const currentImages = [localListing.cleaned?.main_image || '', ...(localListing.cleaned?.other_images || [])].filter(x => x); const idx = currentImages.indexOf(selectedImage); if (idx !== -1) currentImages[idx] = uploadedUrl; const updated = { ...localListing }; if (updated.cleaned) { updated.cleaned.main_image = currentImages[0]; updated.cleaned.other_images = currentImages.slice(1); } setSelectedImage(uploadedUrl); setLocalListing(updated); syncToSupabase(updated); setIsEditorOpen(false); } catch (err: any) { alert(err.message); } }} />}
      {isSourcingOpen && <SourcingModal productImage={localListing.cleaned?.main_image || ''} onClose={() => setIsSourcingOpen(false)} onAddLink={(link) => { const updated = { ...localListing }; if (updated.cleaned) { if (!updated.cleaned.sourcing_links) updated.cleaned.sourcing_links = []; if (!updated.cleaned.sourcing_links.includes(link)) { updated.cleaned.sourcing_links.push(link); setLocalListing(updated); syncToSupabase(updated); } } setIsSourcingOpen(false); }} />}

      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-4 z-40">
        <div className="flex items-center gap-6"><button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-black text-sm uppercase tracking-widest"><ArrowLeft size={18} className="mr-2" /> {t('back')}</button> {lastSaved && <div className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full border border-green-100"><Check size={12} /> Auto-saved @ {lastSaved}</div>}</div>
        <div className="flex gap-4 items-center"><div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200"><button onClick={() => setAiProvider('gemini')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${aiProvider === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Gemini</button><button onClick={() => setAiProvider('openai')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${aiProvider === 'openai' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>GPT-4o</button></div><button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest">{isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} {t('aiOptimize')}</button><button onClick={handleSaveAndNext} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-all active:scale-95 uppercase tracking-widest">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {t('saveAndNext')}</button></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center justify-between text-xs uppercase tracking-widest"><span className="flex items-center gap-2"><ImageIcon size={16} className="text-blue-500" /> Media Gallery</span><button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline flex items-center gap-1 font-black text-[10px] tracking-widest uppercase"><Plus size={14} /> Add</button></h3>
            <div className="relative aspect-square rounded-3xl bg-slate-50 border border-slate-100 overflow-hidden mb-6 group shadow-inner"> {selectedImage ? <img src={selectedImage} className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" alt="Main" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><ImageIcon size={48} /></div>} <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]"><button onClick={() => setIsEditorOpen(true)} className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-black text-xs shadow-2xl flex items-center gap-2 hover:bg-blue-50 transform hover:scale-105 transition-all"><Edit2 size={14} /> Edit with AI</button></div></div>
            <div className="grid grid-cols-4 gap-3"> {allImages.map((img, i) => <div key={i} draggable onDragStart={() => handleDragStart(i)} onDragOver={handleDragOver} onDrop={() => handleDrop(i)} onClick={() => setSelectedImage(img)} onMouseEnter={() => setHoveredImage(img)} onMouseLeave={() => setHoveredImage(null)} className={`relative aspect-square rounded-2xl border-2 group/item cursor-move transition-all overflow-hidden ${selectedImage === img ? 'border-blue-500 scale-95 ring-4 ring-blue-50' : 'border-slate-50 hover:border-slate-300'} ${draggedIdx === i ? 'opacity-20' : ''}`}><img src={img} className="w-full h-full object-cover pointer-events-none" alt="" /> {i === 0 && <div className="absolute top-0 left-0 bg-blue-600 text-[8px] font-black text-white px-2 py-1 rounded-br-xl uppercase shadow-md">Main</div>} <button onClick={(e) => handleDeleteImage(img, e)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-all z-10"><X size={10} /></button></div>)} <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50">{isUploadingLocal ? <Loader2 className="animate-spin" size={16} /> : <Plus size={20} />}</button></div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6"><h3 className="font-black text-slate-900 flex items-center gap-2 text-xs uppercase tracking-widest"><Languages size={16} className="text-purple-500" /> All Global Sites</h3><button onClick={handleTranslateAll} disabled={isTranslatingAll || !localListing.optimized} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md"><Zap size={12} /> Batch All</button></div>
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              <button onClick={() => setActiveMarketplace('en')} className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-black transition-all ${activeMarketplace === 'en' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-100 text-slate-600 hover:border-purple-300'}`}>🇺🇸 USA / UK (EN)</button>
              {AMAZON_MARKETPLACES.filter(m => m.code !== 'US' && m.code !== 'UK').map(m => (
                <button key={m.code} disabled={isTranslating !== null || isTranslatingAll} onClick={() => localListing.translations?.[m.code] ? setActiveMarketplace(m.code) : handleTranslate(m.code)} className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-black transition-all ${activeMarketplace === m.code ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm scale-105' : (localListing.translations?.[m.code] ? 'border-slate-100 text-slate-600 hover:border-purple-300' : 'border-dashed border-slate-200 text-slate-400 hover:bg-slate-50')}`}><span className="flex items-center gap-2"><span>{m.flag}</span> {m.code}</span> {isTranslating === m.code && <Loader2 size={12} className="animate-spin" />}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
             <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Edit2 size={14} /> Global Editor &bull; {AMAZON_MARKETPLACES.find(m => m.code === activeMarketplace)?.name || 'Default (EN)'}</h4></div>
             <div className="p-8 border-b border-slate-100 bg-slate-50/20"><div className="grid grid-cols-2 gap-8"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><DollarSign size={10} /> Price (USD)</label><input type="number" step="0.01" value={localListing.cleaned?.price || 0} onChange={(e) => handleFieldChange('cleaned.price', parseFloat(e.target.value) || 0)} onBlur={handleBlur} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner" /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Truck size={10} /> Shipping (USD)</label><input type="number" step="0.01" value={localListing.cleaned?.shipping || 0} onChange={(e) => handleFieldChange('cleaned.shipping', parseFloat(e.target.value) || 0)} onBlur={handleBlur} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-inner" /></div></div></div>
             {currentContent ? (
               <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                 <div className="space-y-2"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Optimized Title</label><CharCounter count={currentContent.optimized_title?.length || 0} limit={LIMITS.TITLE} /></div><textarea value={currentContent.optimized_title || ''} onChange={(e) => { if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_title', e.target.value); else handleFieldChange(`translations.${activeMarketplace}.optimized_title`, e.target.value); }} onBlur={handleBlur} className={`w-full p-5 bg-white border ${(currentContent.optimized_title?.length || 0) > LIMITS.TITLE ? 'border-red-500 ring-4 ring-red-100' : 'border-slate-200'} rounded-2xl text-base font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px] leading-relaxed transition-all shadow-sm`} /></div>
                 <div className="space-y-2"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Search Keywords</label><CharCounter count={currentContent.search_keywords?.length || 0} limit={LIMITS.KEYWORDS} /></div><input value={currentContent.search_keywords || ''} onChange={(e) => { if (activeMarketplace === 'en') handleFieldChange('optimized.search_keywords', e.target.value); else handleFieldChange(`translations.${activeMarketplace}.search_keywords`, e.target.value); }} onBlur={handleBlur} className={`w-full px-5 py-4 bg-slate-50/50 border ${(currentContent.search_keywords?.length || 0) > LIMITS.KEYWORDS ? 'border-red-500 ring-4 ring-red-100' : 'border-slate-200'} rounded-2xl text-sm font-mono tracking-tight text-slate-600 focus:border-amber-500 outline-none shadow-inner`} /></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10"><div className="space-y-6"><div className="flex justify-between items-center bg-slate-50/80 p-3 rounded-2xl"><label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Bullet Points</label><button onClick={() => { const next = [...(currentContent.optimized_features || []), ""]; if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_features', next); else handleFieldChange(`translations.${activeMarketplace}.optimized_features`, next); }} className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-1"><Plus size={12} /> Add</button></div><div className="space-y-6">{(currentContent.optimized_features || []).map((f: string, i: number) => (<div key={i} className="space-y-2 p-4 rounded-2xl border border-slate-50 hover:bg-slate-50/30 transition-all"><div className="flex justify-between items-center"><span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-400 uppercase">Bullet {i+1}</span><div className="flex items-center gap-3"><CharCounter count={f?.length || 0} limit={LIMITS.BULLET} /><button onClick={() => { const next = currentContent.optimized_features.filter((_: any, idx: number) => idx !== i); if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_features', next); else handleFieldChange(`translations.${activeMarketplace}.optimized_features`, next); }} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={14} /></button></div></div><textarea value={f || ''} onChange={(e) => { const next = [...currentContent.optimized_features]; next[i] = e.target.value; if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_features', next); else handleFieldChange(`translations.${activeMarketplace}.optimized_features`, next); }} onBlur={handleBlur} className={`w-full p-4 bg-white border {(f?.length || 0) > LIMITS.BULLET ? 'border-red-500' : 'border-slate-200'} rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 min-h-[80px] shadow-sm`} /></div>))}</div></div><div className="space-y-2"><div className="flex justify-between items-center bg-slate-50/80 p-3 rounded-2xl"><label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Description</label><CharCounter count={currentContent.optimized_description?.length || 0} limit={LIMITS.DESCRIPTION} /></div><textarea value={currentContent.optimized_description || ''} onChange={(e) => { if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_description', e.target.value); else handleFieldChange(`translations.${activeMarketplace}.optimized_description`, e.target.value); }} onBlur={handleBlur} className={`w-full p-6 bg-white border {(currentContent.optimized_description?.length || 0) > LIMITS.DESCRIPTION ? 'border-red-500' : 'border-slate-200'} rounded-3xl text-xs font-medium text-slate-700 min-h-[500px] leading-loose focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm`} /></div></div>
               </div>
             ) : (
               <div className="p-32 text-center flex flex-col items-center justify-center gap-6 flex-1 bg-slate-50/30"><div className="w-24 h-24 bg-white rounded-[2rem] border border-slate-100 shadow-xl flex items-center justify-center text-slate-100 transform rotate-12"><BrainCircuit size={48} /></div><div className="space-y-2 max-w-sm"><p className="text-slate-800 font-black text-xl tracking-tight uppercase">Ready to Optimize</p><p className="text-slate-400 font-medium text-xs">Initialize AI to generate high-converting content for this product.</p></div><button onClick={handleOptimize} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all">Start Engine</button></div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
