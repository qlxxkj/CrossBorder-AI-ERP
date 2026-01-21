
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  BrainCircuit, Globe, Languages, Loader2, DollarSign, Truck, Settings2, ZoomIn, Save, ChevronRight,
  Zap, Check, AlertCircle, Weight, Ruler, Coins, ListFilter, FileText, Wand2, Star, Upload, Search, ExternalLink, Link2, Maximize2, Edit3
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, PriceAdjustment, ExchangeRate, SourcingRecord } from '../types';
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

const formatNum = (val: any) => {
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? '0' : parseFloat(n.toFixed(2)).toString();
};

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const [activeTab, setActiveTab] = useState<'content' | 'sourcing' | 'logistics'>('content');
  const [activeMarket, setActiveMarket] = useState('US');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState(false);
  
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [selectedImage, setSelectedImage] = useState<string>(listing.cleaned?.main_image || '');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    fetchPricingData();
  }, []);

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
      const updated = { ...localListing, status: 'optimized' as const, optimized: opt };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (e: any) { alert("Optimization failed: " + e.message); } 
    finally { setIsOptimizing(false); }
  };

  const handleTranslate = async (mkt: string) => {
    if (!localListing.optimized) {
      alert("Please optimize in English first.");
      return;
    }
    setIsTranslating(true);
    try {
      const trans = await translateListingWithAI(localListing.optimized, mkt);
      const updated = {
        ...localListing,
        translations: { ...localListing.translations, [mkt]: trans as any }
      };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (e: any) { alert("Translation failed: " + e.message); }
    finally { setIsTranslating(false); }
  };

  const currentContent: OptimizedData | CleanedData = useMemo(() => {
    if (activeMarket !== 'US') {
      return localListing.translations?.[activeMarket] || { optimized_title: '', optimized_features: [], optimized_description: '', search_keywords: '' };
    }
    return localListing.optimized || localListing.cleaned;
  }, [localListing, activeMarket]);

  const updateContent = (field: string, value: any) => {
    if (activeMarket === 'US') {
      if (localListing.status === 'optimized' && localListing.optimized) {
        const next = { ...localListing, optimized: { ...localListing.optimized, [field]: value } };
        setLocalListing(next);
      } else {
        const next = { ...localListing, cleaned: { ...localListing.cleaned, [field]: value } };
        setLocalListing(next);
      }
    } else {
      const currentTrans = localListing.translations?.[activeMarket] || {};
      const next = {
        ...localListing,
        translations: { ...localListing.translations, [activeMarket]: { ...currentTrans, [field]: value } }
      };
      setLocalListing(next);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900 font-inter animate-in fade-in duration-500 pb-20 relative">
      {showImageEditor && <ImageEditor imageUrl={selectedImage} onClose={() => setShowImageEditor(false)} onSave={(url) => { updateContent('main_image', url); setSelectedImage(url); setShowImageEditor(false); }} />}
      {showSourcingModal && <SourcingModal productImage={localListing.cleaned.main_image || ''} onClose={() => setShowSourcingModal(false)} onAddLink={(res) => { const next = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] }; setLocalListing(next); syncToSupabase(next); setShowSourcingModal(false); }} />}
      {showSourcingForm && <SourcingFormModal onClose={() => setShowSourcingForm(false)} onSave={(res) => { const next = { ...localListing, sourcing_data: [...(localListing.sourcing_data || []), res] }; setLocalListing(next); syncToSupabase(next); setShowSourcingForm(false); }} />}

      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-slate-200 shadow-sm sticky top-4 z-40">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-black text-sm uppercase tracking-widest transition-colors">
            <ArrowLeft size={18} className="mr-2" /> {t('back')}
          </button> 
          <div className="h-6 w-px bg-slate-200"></div>
          <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">ASIN: {localListing.asin}</span>
          {lastSaved && <div className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase bg-green-50 px-3 py-1 rounded-full border border-green-100"><Check size={12} /> Auto-saved @ {lastSaved}</div>}
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all uppercase shadow-sm">
            {isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} className="text-indigo-500" />} 
            AI Optimize
          </button>
          <button onClick={() => syncToSupabase(localListing)} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all uppercase">
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {t('save')}
          </button>
          <button onClick={onNext} className="p-2.5 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-all">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Media & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative group overflow-hidden">
             <div className="aspect-square rounded-[2rem] bg-slate-50 border border-slate-100 overflow-hidden mb-6 flex items-center justify-center p-4">
                <img src={selectedImage} className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-700" alt="Main" />
             </div>
             <div className="grid grid-cols-5 gap-3">
                {[localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])].filter(Boolean).slice(0, 5).map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => setSelectedImage(img!)}
                    className={`aspect-square rounded-xl border-2 transition-all overflow-hidden bg-slate-50 ${selectedImage === img ? 'border-indigo-600 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img!} className="w-full h-full object-cover" />
                  </button>
                ))}
             </div>
             <button onClick={() => setShowImageEditor(true)} className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl hover:bg-slate-800 active:scale-95 transition-all">
                <Wand2 size={16} className="text-blue-400" /> AI Media Lab
             </button>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-amber-500" /> Optimization Status</h3>
             <div className="space-y-4">
                <StatusItem label="Content Grade" value={localListing.status === 'optimized' ? 'A+' : 'C'} sub="Based on Amazon A10 Algorithm" />
                <StatusItem label="SEO Health" value={localListing.status === 'optimized' ? 'Optimal' : 'Needs Review'} color={localListing.status === 'optimized' ? 'text-green-500' : 'text-amber-500'} />
             </div>
          </div>
        </div>

        {/* Right: Content Editor */}
        <div className="lg:col-span-8 space-y-6">
           <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-10 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-inner">
                    <button onClick={() => setActiveTab('content')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'content' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Content</button>
                    <button onClick={() => setActiveTab('logistics')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'logistics' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Logistics</button>
                    <button onClick={() => setActiveTab('sourcing')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'sourcing' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Sourcing</button>
                 </div>
                 
                 {activeTab === 'content' && (
                   <div className="flex items-center gap-3">
                      <select 
                        value={activeMarket} 
                        onChange={(e) => setActiveMarket(e.target.value)}
                        className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none border-none shadow-xl cursor-pointer"
                      >
                         <option value="US">🇺🇸 USA (Primary)</option>
                         {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => (
                           <option key={m.code} value={m.code}>{m.flag} {m.name}</option>
                         ))}
                      </select>
                      {activeMarket !== 'US' && !localListing.translations?.[activeMarket] && (
                        <button onClick={() => handleTranslate(activeMarket)} disabled={isTranslating} className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all">
                           {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} 
                           Translate to {activeMarket}
                        </button>
                      )}
                   </div>
                 )}
              </div>

              <div className="p-10">
                 {activeTab === 'content' ? (
                   <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                      <section className="space-y-3">
                         <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Title</label>
                            <span className="text-[10px] font-black text-slate-300">{(currentContent as any).optimized_title?.length || (currentContent as any).title?.length || 0} / 200</span>
                         </div>
                         <textarea 
                          value={(currentContent as any).optimized_title || (currentContent as any).title || ''} 
                          onChange={(e) => updateContent(activeMarket === 'US' ? 'optimized_title' : 'optimized_title', e.target.value)}
                          className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] font-bold text-lg leading-relaxed outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:italic min-h-[120px]" 
                         />
                      </section>

                      <section className="space-y-4">
                         <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1 flex items-center gap-2"><ListFilter size={14} /> Feature Bullets (AI Optimized)</label>
                         <div className="space-y-3">
                            {((currentContent as any).optimized_features || (currentContent as any).features || []).map((f: string, i: number) => (
                              <div key={i} className="flex items-start gap-4 group">
                                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-2">{i+1}</div>
                                 <textarea 
                                  value={f}
                                  onChange={(e) => {
                                    const next = [...((currentContent as any).optimized_features || (currentContent as any).features || [])];
                                    next[i] = e.target.value;
                                    updateContent('optimized_features', next);
                                  }}
                                  className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold leading-relaxed focus:bg-white focus:border-indigo-500 transition-all outline-none min-h-[80px]"
                                 />
                              </div>
                            ))}
                         </div>
                      </section>

                      <section className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><FileText size={14} /> HTML Description</label>
                         <textarea 
                          value={(currentContent as any).optimized_description || (currentContent as any).description || ''} 
                          onChange={(e) => updateContent('optimized_description', e.target.value)}
                          className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-medium leading-loose outline-none focus:bg-white focus:border-indigo-500 transition-all min-h-[300px] font-mono text-slate-600" 
                         />
                      </section>
                   </div>
                 ) : activeTab === 'logistics' ? (
                   <div className="grid grid-cols-2 gap-10 animate-in slide-in-from-right-4 duration-300 py-10">
                      <section className="space-y-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Weight size={16} /> Net Weight</h4>
                        <div className="flex gap-4">
                           <input type="text" value={(currentContent as any).optimized_weight_value || (currentContent as any).item_weight_value || ''} onChange={e => updateContent('optimized_weight_value', e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none" />
                           <select value={(currentContent as any).optimized_weight_unit || (currentContent as any).item_weight_unit || 'lb'} onChange={e => updateContent('optimized_weight_unit', e.target.value)} className="bg-white border border-slate-200 rounded-2xl px-4 font-black uppercase text-xs">
                              <option value="lb">LB</option>
                              <option value="kg">KG</option>
                              <option value="oz">OZ</option>
                           </select>
                        </div>
                      </section>
                      <section className="space-y-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Ruler size={16} /> Dimensions (L/W/H)</h4>
                        <div className="grid grid-cols-3 gap-3">
                           <input type="text" placeholder="L" value={(currentContent as any).optimized_length || (currentContent as any).item_length || ''} onChange={e => updateContent('optimized_length', e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-center" />
                           <input type="text" placeholder="W" value={(currentContent as any).optimized_width || (currentContent as any).item_width || ''} onChange={e => updateContent('optimized_width', e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-center" />
                           <input type="text" placeholder="H" value={(currentContent as any).optimized_height || (currentContent as any).item_height || ''} onChange={e => updateContent('optimized_height', e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-center" />
                        </div>
                      </section>
                   </div>
                 ) : (
                   <div className="space-y-10 animate-in slide-in-from-right-4 duration-300 py-4">
                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Wholesale & Factory Links</h3>
                            <p className="text-xs text-slate-400 font-bold">Bridge your Amazon listings directly to source manufacturers.</p>
                         </div>
                         <div className="flex gap-3">
                            <button onClick={() => setShowSourcingModal(true)} className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all">
                               <Search size={14} /> AI Discovery
                            </button>
                            <button onClick={() => setShowSourcingForm(true)} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                               <Plus size={14} /> Manual Add
                            </button>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {(localListing.sourcing_data || []).map((s, idx) => (
                           <div key={idx} className="group bg-slate-50 border border-slate-100 p-6 rounded-[2.5rem] flex items-center gap-6 relative hover:bg-white hover:shadow-2xl hover:border-orange-200 transition-all">
                              <div className="w-20 h-20 bg-white rounded-2xl overflow-hidden border border-slate-200 shrink-0">
                                 <img src={s.image} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                 <p className="font-black text-slate-900 truncate">{s.title}</p>
                                 <p className="text-orange-600 font-black text-lg mt-1">{s.price}</p>
                                 <a href={s.url} target="_blank" className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-blue-600 mt-3 uppercase tracking-widest transition-colors">
                                   Open Supplier <ExternalLink size={10} />
                                 </a>
                              </div>
                              <button onClick={() => { const next = { ...localListing, sourcing_data: (localListing.sourcing_data || []).filter((_, i) => i !== idx) }; setLocalListing(next); syncToSupabase(next); }} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={16} />
                              </button>
                           </div>
                         ))}
                         {(localListing.sourcing_data || []).length === 0 && (
                           <div className="col-span-2 py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center opacity-40">
                              <Link2 size={40} className="mb-4" />
                              <p className="text-[10px] font-black uppercase tracking-widest">No verified factory sources linked</p>
                           </div>
                         )}
                      </div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatusItem = ({ label, value, color = "text-slate-900", sub }: any) => (
  <div className="space-y-1">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</p>
    <p className={`text-lg font-black ${color} tracking-tight`}>{value}</p>
    {sub && <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter ml-1">{sub}</p>}
  </div>
);
