import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  Globe, Languages, Loader2, DollarSign, Truck, Save, ChevronRight,
  Zap, Check, Weight, Ruler, ListFilter, FileText, Wand2, Search, 
  ExternalLink, Link2, Star, Maximize2, Hash, Cpu, Brain, Box
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, ExchangeRate, SourcingRecord } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from '../services/openaiService';
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from '../services/deepseekService';
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

type AIEngine = 'gemini' | 'openai' | 'deepseek';

const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const METRIC_MARKETS = ['DE', 'FR', 'IT', 'ES', 'JP', 'UK', 'CA', 'MX', 'PL', 'NL', 'SE', 'BE', 'SG', 'AU', 'EG'];

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<AIEngine>(() => (localStorage.getItem('amzbot_preferred_engine') as AIEngine) || 'gemini');

  useEffect(() => { localStorage.setItem('amzbot_preferred_engine', engine); }, [engine]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [translatingMarkets, setTranslatingMarkets] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState<{show: boolean, data: SourcingRecord | null}>({show: false, data: null});
  
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
    } catch (e) { console.error(e); } 
    finally { setIsSaving(false); }
  };

  /**
   * 修复核心：更健壮的字段获取逻辑
   */
  const getFieldValue = (optField: string, cleanField: string) => {
    // 1. 如果不是主站点，先看翻译
    if (activeMarket !== 'US') {
      const trans = localListing.translations?.[activeMarket];
      if (trans) {
        const val = (trans as any)[optField];
        if (Array.isArray(val) && val.length > 0 && val.some(v => v && String(v).trim() !== '')) return val;
        if (val !== undefined && val !== null && String(val).trim() !== '') return val;
      }
    }

    // 2. 看优化数据 (optimized)
    const optVal = localListing.optimized ? (localListing.optimized as any)[optField] : null;
    if (optField.includes('features')) {
      if (Array.isArray(optVal) && optVal.length > 0 && optVal.some(v => v && String(v).trim() !== '')) return optVal;
    } else {
      if (optVal !== undefined && optVal !== null && String(optVal).trim() !== '') return optVal;
    }

    // 3. 兜底采集数据 (cleaned)
    const cleanVal = (localListing.cleaned as any)[cleanField];
    if (optField.includes('features')) {
      if (Array.isArray(cleanVal) && cleanVal.length > 0) return cleanVal;
      return ['', '', '', '', ''];
    }
    return cleanVal !== undefined && cleanVal !== null ? String(cleanVal) : '';
  };

  const updateField = (field: string, value: any) => {
    const nextListing = { ...localListing };
    if (activeMarket === 'US') {
      nextListing.optimized = { ...(nextListing.optimized || {}), [field]: value } as OptimizedData;
    } else {
      const currentTranslations = { ...(nextListing.translations || {}) };
      const currentTrans = currentTranslations[activeMarket] || { optimized_title: '', optimized_features: ['', '', '', '', ''], optimized_description: '', search_keywords: '' } as OptimizedData;
      currentTranslations[activeMarket] = { ...currentTrans, [field]: value };
      nextListing.translations = currentTranslations;
    }
    setLocalListing(nextListing);
    onUpdate(nextListing);
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(localListing.cleaned!);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(localListing.cleaned!);
      else opt = await optimizeListingWithAI(localListing.cleaned!);
      const updated: Listing = { ...localListing, status: 'optimized', optimized: opt };
      setLocalListing(updated); onUpdate(updated); await syncToSupabase(updated);
    } catch (e: any) { alert(`Failed: ${e.message}`); } 
    finally { setIsOptimizing(false); }
  };

  const translateMarket = async (marketCode: string) => {
    if (marketCode === 'US') return;
    setTranslatingMarkets(prev => new Set(prev).add(marketCode));
    try {
      const sourceData = localListing.optimized || {
        optimized_title: localListing.cleaned.title,
        optimized_features: localListing.cleaned.features || [],
        optimized_description: localListing.cleaned.description || '',
        search_keywords: localListing.cleaned.search_keywords || ''
      } as OptimizedData;
      
      let trans: Partial<OptimizedData>;
      if (engine === 'openai') trans = await translateListingWithOpenAI(sourceData, marketCode);
      else if (engine === 'deepseek') trans = await translateListingWithDeepSeek(sourceData, marketCode);
      else trans = await translateListingWithAI(sourceData, marketCode);
      
      const nextListing = { ...localListing };
      nextListing.translations = { ...(nextListing.translations || {}), [marketCode]: trans as OptimizedData };
      setLocalListing(nextListing); onUpdate(nextListing);
    } catch (e) { console.error(e); } 
    finally { setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(marketCode); return n; }); }
  };

  const handleBatchTranslate = async () => {
    setIsBatchTranslating(true);
    for (const mkt of AMAZON_MARKETPLACES) {
      if (mkt.code !== 'US') await translateMarket(mkt.code);
    }
    setIsBatchTranslating(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="group flex items-center text-slate-500 hover:text-slate-900 font-black text-xs uppercase transition-all">
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> {t('back')}
          </button> 
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
             {['gemini', 'openai', 'deepseek'].map(e => (
               <button key={e} onClick={() => setEngine(e as AIEngine)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${engine === e ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                 {e === 'gemini' ? <Zap size={12}/> : e === 'openai' ? <Brain size={12}/> : <Cpu size={12}/>} {e}
               </button>
             ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all uppercase shadow-sm">
            {isOptimizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} AI Optimize
          </button>
          <button onClick={() => syncToSupabase(localListing)} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-xs text-white bg-slate-900 hover:bg-black shadow-xl uppercase tracking-widest">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('save')}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* 左侧栏：图片 + 搜货 */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
                   <img src={previewImage} className="max-w-full max-h-full object-contain transition-transform group-hover:scale-110" />
                   <button onClick={() => setShowImageEditor(true)} className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all">
                      <Wand2 size={12} /> AI Editor
                   </button>
                </div>
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                   {[localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])].filter(Boolean).map((img, i) => (
                     <div key={i} onClick={() => setPreviewImage(img!)} className={`w-16 h-16 rounded-xl border-2 cursor-pointer overflow-hidden transition-all ${previewImage === img ? 'border-indigo-500 shadow-lg' : 'border-transparent opacity-60'}`}>
                        <img src={img!} className="w-full h-full object-cover" />
                     </div>
                   ))}
                </div>
             </div>

             {/* 搜货组件（移动到此） */}
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Link2 size={14} className="text-orange-500" /> Sourcing Discovery</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setShowSourcingModal(true)} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-all"><Search size={14} /></button>
                    <button onClick={() => setShowSourcingForm({show: true, data: null})} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-all"><Plus size={14} /></button>
                  </div>
                </div>
                
                <div className="space-y-3">
                   {(localListing.sourcing_data || []).map((s, idx) => (
                     <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <img src={s.image} className="w-10 h-10 rounded-lg object-cover" />
                        <div className="flex-1 overflow-hidden">
                           <p className="text-[9px] font-black text-slate-800 truncate">{s.title}</p>
                           <p className="text-[9px] font-bold text-orange-600 uppercase">{s.price}</p>
                        </div>
                        <div className="flex opacity-0 group-hover:opacity-100 transition-all">
                           <a href={s.url} target="_blank" className="p-1.5 text-slate-300 hover:text-blue-500"><ExternalLink size={12}/></a>
                           <button onClick={() => { const n = { ...localListing, sourcing_data: (localListing.sourcing_data || []).filter((_, i) => i !== idx) }; setLocalListing(n); onUpdate(n); }} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                     </div>
                   ))}
                   {(localListing.sourcing_data || []).length === 0 && (
                      <p className="text-center py-6 text-[10px] font-bold text-slate-300 uppercase italic">No sourcing data attached.</p>
                   )}
                </div>
             </div>
          </div>

          {/* 右侧栏：编辑器 */}
          <div className="lg:col-span-8">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-3">
                      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto no-scrollbar">
                         <button onClick={() => setActiveMarket('US')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>🇺🇸 Master</button>
                         {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => (
                           <button key={m.code} onClick={() => setActiveMarket(m.code)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 flex items-center gap-2 ${activeMarket === m.code ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-300 hover:text-slate-500'}`}>
                             {m.flag} {m.code}
                             {translatingMarkets.has(m.code) && <Loader2 size={10} className="animate-spin" />}
                           </button>
                         ))}
                      </div>
                      <button onClick={handleBatchTranslate} disabled={isBatchTranslating} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shadow-sm" title="Translate All Markets">
                          {isBatchTranslating ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                      </button>
                   </div>
                </div>

                <div className="p-10 space-y-10">
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign size={14} className="text-emerald-500" /> Price ({activeMarket})</label>
                         <input type="number" step="0.01" value={getFieldValue('optimized_price', 'price')} onChange={(e) => updateField('optimized_price', parseFloat(e.target.value))} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none" />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Shipping</label>
                         <input type="number" step="0.01" value={getFieldValue('optimized_shipping', 'shipping')} onChange={(e) => updateField('optimized_shipping', parseFloat(e.target.value))} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none" />
                      </div>
                   </div>

                   <EditSection 
                    label="Product Title" icon={<ImageIcon size={14}/>} 
                    value={getFieldValue('optimized_title', 'title')}
                    onChange={v => updateField('optimized_title', v)}
                    limit={200} className="text-xl font-black"
                   />

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Key Features (Bullets)</label>
                      <div className="space-y-3">
                         {(getFieldValue('optimized_features', 'features') as string[]).map((f: string, i: number) => (
                           <div key={i} className="flex gap-4 group">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-2 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</div>
                              <div className="flex-1 space-y-1">
                                 <textarea 
                                   value={f || ''}
                                   onChange={(e) => {
                                     const current = [...(getFieldValue('optimized_features', 'features') as string[])];
                                     current[i] = e.target.value;
                                     updateField('optimized_features', current);
                                   }}
                                   className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold leading-relaxed focus:bg-white outline-none transition-all ${f.length > 250 ? 'border-red-400' : 'border-slate-200'}`}
                                   placeholder={`Bullet Point ${i+1}...`}
                                 />
                                 <div className="flex justify-between items-center px-1 text-[9px] font-black uppercase">
                                    <span className={f.length > 250 ? 'text-red-500' : 'text-slate-400'}>{f.length} / 250</span>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>

                   <EditSection 
                    label="Description (HTML)" icon={<FileText size={14}/>} 
                    value={getFieldValue('optimized_description', 'description')}
                    onChange={v => updateField('optimized_description', v)}
                    limit={2000} isMono className="min-h-[250px] text-xs"
                   />

                   <EditSection 
                    label="Search Keywords" icon={<Hash size={14}/>} 
                    value={getFieldValue('search_keywords', 'search_keywords')}
                    onChange={v => updateField('search_keywords', v)}
                    limit={250} className="bg-amber-50/20 border-amber-100 text-sm font-bold"
                   />
                </div>
             </div>
          </div>
        </div>
      </div>

      {showSourcingForm.show && (
        <SourcingFormModal 
          initialData={showSourcingForm.data} 
          onClose={() => setShowSourcingForm({show: false, data: null})} 
          onSave={(res) => {
            const nextData = [...(localListing.sourcing_data || [])];
            const existingIdx = nextData.findIndex(s => s.id === res.id);
            if (existingIdx >= 0) nextData[existingIdx] = res; else nextData.push(res);
            const next = { ...localListing, sourcing_data: nextData };
            setLocalListing(next); onUpdate(next); syncToSupabase(next); setShowSourcingForm({show: false, data: null});
          }} 
        />
      )}

      {showSourcingModal && (
        <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={(res) => {
            const next = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] };
            setLocalListing(next); onUpdate(next); syncToSupabase(next); setShowSourcingModal(false);
          }}
        />
      )}

      {showImageEditor && <ImageEditor imageUrl={previewImage} onClose={() => setShowImageEditor(false)} onSave={(url) => { setPreviewImage(url); updateField('main_image', url); setShowImageEditor(false); }} uiLang={uiLang} />}
    </div>
  );
};

const EditSection = ({ label, icon, value, onChange, limit, isMono, className }: any) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between ml-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">{icon} {label}</label>
      {limit && <span className={`text-[9px] font-black uppercase ${(value || '').length > limit ? 'text-red-500' : 'text-slate-400'}`}>{(value || '').length} / {limit}</span>}
    </div>
    <textarea 
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full p-6 bg-slate-50 border rounded-[2rem] font-bold outline-none transition-all focus:bg-white ${isMono ? 'font-mono' : ''} border-slate-200 focus:border-indigo-500 ${className}`}
    />
  </div>
);