
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  Globe, Languages, Loader2, DollarSign, Truck, Save, ChevronRight,
  Zap, Check, Weight, Ruler, ListFilter, FileText, Wand2, Search, 
  ExternalLink, Link2, Star, Maximize2, MoveHorizontal, Hash
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, ExchangeRate, SourcingRecord } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
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

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const [activeMarket, setActiveMarket] = useState('US');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState(false);
  
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
    } catch (e: any) { 
      console.error("Save failed:", e);
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const opt = await optimizeListingWithAI(localListing.cleaned!);
      const updated: Listing = { ...localListing, status: 'optimized', optimized: opt };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (e: any) { 
      alert("AI Optimization failed: " + e.message); 
    } finally { 
      setIsOptimizing(false); 
    }
  };

  const handleTranslate = async (mkt: string) => {
    if (!localListing.optimized && !localListing.cleaned) return;
    setIsTranslating(true);
    try {
      const sourceData = localListing.optimized || {
        optimized_title: localListing.cleaned.title,
        optimized_features: localListing.cleaned.features || [],
        optimized_description: localListing.cleaned.description || '',
        search_keywords: localListing.cleaned.search_keywords || ''
      } as OptimizedData;

      const trans = await translateListingWithAI(sourceData, mkt);
      const nextListing = { ...localListing };
      const currentTranslations = { ...(nextListing.translations || {}) };
      currentTranslations[mkt] = trans as OptimizedData;
      nextListing.translations = currentTranslations;
      
      setLocalListing(nextListing);
      await syncToSupabase(nextListing);
    } catch (e: any) { 
      alert("Translation failed: " + e.message); 
    } finally { 
      setIsTranslating(false); 
    }
  };

  const currentContent = useMemo(() => {
    if (activeMarket !== 'US') {
      return localListing.translations?.[activeMarket] || { 
        optimized_title: '', optimized_features: [], optimized_description: '', search_keywords: '' 
      } as OptimizedData;
    }
    return localListing.optimized || localListing.cleaned;
  }, [localListing, activeMarket]);

  const updateField = (field: string, value: any) => {
    const nextListing = { ...localListing };
    if (activeMarket === 'US') {
      if (nextListing.optimized && nextListing.status === 'optimized') {
        nextListing.optimized = { ...nextListing.optimized, [field]: value };
      } else {
        nextListing.cleaned = { ...nextListing.cleaned, [field]: value };
      }
    } else {
      const currentTranslations = { ...(nextListing.translations || {}) };
      const currentTrans = currentTranslations[activeMarket] || {
        optimized_title: '', optimized_features: [], optimized_description: '', search_keywords: ''
      } as OptimizedData;
      currentTranslations[activeMarket] = { ...currentTrans, [field]: value };
      nextListing.translations = currentTranslations;
    }
    setLocalListing(nextListing);
  };

  const setAsMainImage = (url: string) => {
    const next = { ...localListing };
    const others = [next.cleaned.main_image, ...(next.cleaned.other_images || [])].filter(x => x && x !== url);
    next.cleaned.main_image = url;
    next.cleaned.other_images = others as string[];
    setLocalListing(next);
    setPreviewImage(url);
  };

  const deleteImage = (url: string) => {
    const next = { ...localListing };
    if (next.cleaned.main_image === url) {
      const firstOther = next.cleaned.other_images?.[0];
      next.cleaned.main_image = firstOther || '';
      next.cleaned.other_images = next.cleaned.other_images?.slice(1) || [];
      setPreviewImage(next.cleaned.main_image);
    } else {
      next.cleaned.other_images = next.cleaned.other_images?.filter(x => x !== url) || [];
    }
    setLocalListing(next);
  };

  const allImages = [localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])].filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-inter overflow-hidden">
      {/* 顶部工具栏 - Sticky Toolbar */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="group flex items-center text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-all">
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> {t('back')}
          </button> 
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Listing Entity</span>
            <span className="text-sm font-black text-slate-800">{localListing.asin}</span>
          </div>
          {lastSaved && <div className="flex items-center gap-2 text-[10px] font-black text-green-500 uppercase bg-green-50 px-3 py-1 rounded-full border border-green-100 animate-in fade-in"><Check size={12} /> Saved {lastSaved}</div>}
        </div>
        
        <div className="flex gap-3">
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all uppercase shadow-sm">
            {isOptimizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} className="text-indigo-500" />} 
            {t('optimize')}
          </button>
          <button onClick={() => syncToSupabase(localListing)} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-xs text-white bg-slate-900 hover:bg-black shadow-xl active:scale-95 transition-all uppercase tracking-widest">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('save')}
          </button>
          <button onClick={onNext} className="p-2.5 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-all border border-slate-200">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* 主体内容区 - Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* 左侧：媒体中心 - Left Media Center */}
          <div className="lg:col-span-5 space-y-6 sticky top-0">
             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex gap-6 h-[450px]">
                   {/* 缩略图列表 */}
                   <div className="w-20 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
                      {allImages.map((img, i) => (
                        <div 
                          key={i} 
                          onMouseEnter={() => setPreviewImage(img)}
                          className={`relative aspect-square rounded-xl border-2 transition-all cursor-pointer overflow-hidden bg-slate-50 shrink-0 ${previewImage === img ? 'border-indigo-600 shadow-md scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          <img src={img} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                             <button onClick={(e) => { e.stopPropagation(); setAsMainImage(img); }} className="p-1 text-white hover:text-amber-400" title="Set Main"><Star size={12} fill={img === localListing.cleaned.main_image ? "currentColor" : "none"} /></button>
                             <button onClick={(e) => { e.stopPropagation(); deleteImage(img); }} className="p-1 text-white hover:text-red-400" title="Delete"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                      <button className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50 shrink-0">
                         <Plus size={20} />
                      </button>
                   </div>
                   
                   {/* 大图预览区域 */}
                   <div className="flex-1 bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden relative flex items-center justify-center group">
                      <img src={previewImage} className="max-w-full max-h-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        <button onClick={() => setShowImageEditor(true)} className="px-5 py-2.5 bg-white/90 backdrop-blur-md text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all">
                           <Wand2 size={14} className="text-indigo-500" /> AI Lab
                        </button>
                        <a href={previewImage} target="_blank" className="p-2.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 text-slate-500 hover:text-indigo-600 shadow-xl transition-all">
                           <Maximize2 size={14} />
                        </a>
                      </div>
                   </div>
                </div>
             </div>

             {/* 状态卡片 */}
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Marketplace</p>
                   <div className="flex items-center gap-2">
                      <span className="text-xl">{AMAZON_MARKETPLACES.find(m => m.code === localListing.marketplace)?.flag}</span>
                      <span className="font-black text-slate-800">{localListing.marketplace} Node</span>
                   </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                   <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${localListing.status === 'optimized' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                      {localListing.status}
                   </span>
                </div>
             </div>
          </div>

          {/* 右侧：编辑区 - Right Editor */}
          <div className="lg:col-span-7 space-y-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                {/* 站点与翻译切换器 */}
                <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                   <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-inner">
                      <button onClick={() => setActiveMarket('US')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeMarket === 'US' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>🇺🇸 US Master</button>
                      <div className="w-px h-4 bg-slate-200 self-center mx-1"></div>
                      <select 
                        value={activeMarket === 'US' ? '' : activeMarket} 
                        onChange={(e) => setActiveMarket(e.target.value)}
                        className={`bg-transparent px-4 py-2 text-[10px] font-black uppercase outline-none cursor-pointer ${activeMarket !== 'US' ? 'text-indigo-600' : 'text-slate-400'}`}
                      >
                         <option value="" disabled>Other Markets</option>
                         {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => (
                           <option key={m.code} value={m.code}>{m.flag} {m.code}</option>
                         ))}
                      </select>
                   </div>
                   
                   {activeMarket !== 'US' && (
                     <button onClick={() => handleTranslate(activeMarket)} disabled={isTranslating} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                        {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} 
                        {isTranslating ? 'Translating...' : `Translate to ${activeMarket}`}
                     </button>
                   )}
                </div>

                <div className="p-10 space-y-10">
                   {/* 核心参数：价格 & 物流 */}
                   <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><DollarSign size={12}/> Price ({activeMarket})</label>
                        <input 
                          type="number" step="0.01" 
                          value={activeMarket === 'US' ? (localListing.status === 'optimized' ? (currentContent as OptimizedData).optimized_price : localListing.cleaned.price) : (currentContent as OptimizedData).optimized_price || ''}
                          onChange={(e) => updateField(activeMarket === 'US' ? (localListing.status === 'optimized' ? 'optimized_price' : 'price') : 'optimized_price', parseFloat(e.target.value))}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Weight size={12}/> Weight</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={(currentContent as any).optimized_weight_value || (currentContent as any).item_weight_value || ''} 
                            onChange={(e) => updateField(activeMarket === 'US' ? (localListing.status === 'optimized' ? 'optimized_weight_value' : 'item_weight_value') : 'optimized_weight_value', e.target.value)}
                            className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" 
                          />
                          <select 
                            value={(currentContent as any).optimized_weight_unit || (currentContent as any).item_weight_unit || 'lb'} 
                            onChange={(e) => updateField(activeMarket === 'US' ? (localListing.status === 'optimized' ? 'optimized_weight_unit' : 'item_weight_unit') : 'optimized_weight_unit', e.target.value)}
                            className="w-20 px-2 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase"
                          >
                            <option value="lb">LB</option>
                            <option value="kg">KG</option>
                            <option value="oz">OZ</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Ruler size={12}/> Dimensions (L/W/H)</label>
                        <div className="grid grid-cols-3 gap-2">
                           <input placeholder="L" type="text" value={(currentContent as any).optimized_length || (currentContent as any).item_length || ''} onChange={e => updateField(activeMarket === 'US' ? 'optimized_length' : 'optimized_length', e.target.value)} className="w-full px-2 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-xs" />
                           <input placeholder="W" type="text" value={(currentContent as any).optimized_width || (currentContent as any).item_width || ''} onChange={e => updateField(activeMarket === 'US' ? 'optimized_width' : 'optimized_width', e.target.value)} className="w-full px-2 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-xs" />
                           <input placeholder="H" type="text" value={(currentContent as any).optimized_height || (currentContent as any).item_height || ''} onChange={e => updateField(activeMarket === 'US' ? 'optimized_height' : 'optimized_height', e.target.value)} className="w-full px-2 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-xs" />
                        </div>
                      </div>
                   </section>

                   {/* 标题编辑 */}
                   <section className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14} className="text-blue-500" /> Listing Title</label>
                        <span className={`text-[10px] font-black ${(currentContent as any).optimized_title?.length > 200 ? 'text-red-500' : 'text-slate-300'}`}>{(currentContent as any).optimized_title?.length || 0} / 200</span>
                      </div>
                      <textarea 
                        value={(currentContent as any).optimized_title || (currentContent as any).title || ''} 
                        onChange={(e) => updateField(activeMarket === 'US' ? (localListing.status === 'optimized' ? 'optimized_title' : 'title') : 'optimized_title', e.target.value)}
                        className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-lg leading-relaxed outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all min-h-[100px]" 
                      />
                   </section>

                   {/* 五点描述 - Bullet Points */}
                   <section className="space-y-4">
                      <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1 flex items-center gap-2"><ListFilter size={14} /> Feature Bullet Points</label>
                      <div className="space-y-3">
                        {((currentContent as any).optimized_features || (currentContent as any).features || ['', '', '', '', '']).map((f: string, i: number) => (
                          <div key={i} className="flex items-start gap-4 group">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-2 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</div>
                             <textarea 
                               value={f}
                               onChange={(e) => {
                                 const nextF = [...((currentContent as any).optimized_features || (currentContent as any).features || [])];
                                 nextF[i] = e.target.value;
                                 updateField(activeMarket === 'US' ? (localListing.status === 'optimized' ? 'optimized_features' : 'features') : 'optimized_features', nextF);
                               }}
                               className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold leading-relaxed focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[80px]"
                               placeholder={`Point ${i+1}...`}
                             />
                          </div>
                        ))}
                      </div>
                   </section>

                   {/* 长描述 - Description */}
                   <section className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><FileText size={14} /> Product Description (HTML)</label>
                      <textarea 
                        value={(currentContent as any).optimized_description || (currentContent as any).description || ''} 
                        onChange={(e) => updateField(activeMarket === 'US' ? (localListing.status === 'optimized' ? 'optimized_description' : 'description') : 'optimized_description', e.target.value)}
                        className="w-full p-8 bg-slate-50 border border-slate-200 rounded-[2.5rem] text-xs font-mono text-slate-600 leading-loose outline-none focus:bg-white focus:border-indigo-500 transition-all min-h-[300px]" 
                      />
                   </section>

                   {/* 搜索关键词 - Keywords */}
                   <section className="space-y-3">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1 flex items-center gap-2"><Hash size={14} /> Backend Search Keywords</label>
                      <textarea 
                        value={(currentContent as any).search_keywords || ''} 
                        onChange={(e) => updateField('search_keywords', e.target.value)}
                        placeholder="keyword1, keyword2, keyword3..."
                        className="w-full p-6 bg-amber-50/20 border border-amber-100 rounded-3xl text-sm font-bold text-slate-600 outline-none focus:bg-white focus:border-amber-400 transition-all min-h-[100px]" 
                      />
                   </section>
                </div>
             </div>

             {/* 搜货中心 - Sourcing Center */}
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10 space-y-8">
                <div className="flex items-center justify-between">
                   <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg"><Link2 size={20} /></div>
                        1688 Sourcing Intelligence
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mt-1">Real-time manufacturer connections and wholesale benchmarks.</p>
                   </div>
                   <div className="flex gap-3">
                      <button onClick={() => setShowSourcingModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all">
                         <Search size={14} /> AI Discovery
                      </button>
                      <button onClick={() => setShowSourcingForm(true)} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                         <Plus size={14} /> Manual
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {(localListing.sourcing_data || []).map((s, idx) => (
                     <div key={idx} className="group bg-slate-50 border border-slate-100 p-5 rounded-[2rem] flex items-center gap-5 relative hover:bg-white hover:shadow-2xl hover:border-orange-200 transition-all">
                        <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden border border-slate-200 shrink-0">
                           <img src={s.image} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                           <p className="text-xs font-black text-slate-900 truncate">{s.title}</p>
                           <p className="text-orange-600 font-black text-lg mt-0.5">{s.price}</p>
                           <a href={s.url} target="_blank" className="inline-flex items-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-blue-600 mt-2 uppercase tracking-widest transition-colors">
                             View Supplier <ExternalLink size={10} />
                           </a>
                        </div>
                        <button onClick={() => { 
                          const next = { ...localListing, sourcing_data: (localListing.sourcing_data || []).filter((_, i) => i !== idx) }; 
                          setLocalListing(next); 
                          syncToSupabase(next); 
                        }} className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={14} />
                        </button>
                     </div>
                   ))}
                   {(localListing.sourcing_data || []).length === 0 && (
                     <div className="col-span-2 py-16 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center opacity-30">
                        <Link2 size={32} className="mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No sourcing links mapped to this listing</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
