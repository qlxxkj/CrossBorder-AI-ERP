
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

  const performTranslation = async (currentListing: Listing, marketCode: string): Promise<Listing> => {
    const mktConfig = AMAZON_MARKETPLACES.find(m => m.code === marketCode);
    const targetLangName = LANG_NAME_MAP[mktConfig?.lang || 'en'] || 'English';
    // Always translate from the master optimized version if available
    const source = currentListing.optimized || { 
      optimized_title: currentListing.cleaned.title, 
      optimized_features: currentListing.cleaned.features || [],
      optimized_description: currentListing.cleaned.description || "",
      search_keywords: currentListing.cleaned.search_keywords || ""
    } as OptimizedData;

    let transResult: any;
    if (engine === 'openai') transResult = await translateListingWithOpenAI(source, targetLangName);
    else if (engine === 'deepseek') transResult = await translateListingWithDeepSeek(source, targetLangName);
    else transResult = await translateListingWithAI(source, targetLangName);

    // Rule: Trigger forced logistics conversion for non-US markets
    const logistics = calculateMarketLogistics(currentListing, marketCode);
    const rate = exchangeRates.find(r => r.marketplace === marketCode)?.rate || 1;
    
    const finalData: OptimizedData = {
      ...transResult, 
      ...logistics, 
      optimized_price: parseFloat(((currentListing.cleaned.price || 0) * rate).toFixed(2)),
      optimized_shipping: parseFloat(((currentListing.cleaned.shipping || 0) * rate).toFixed(2))
    };

    const nextListing = { ...currentListing, translations: { ...(currentListing.translations || {}), [marketCode]: finalData } };
    return nextListing;
  };

  const handleTranslateSingle = async (code: string, force: boolean = false) => {
    if (code === 'US' || (translatingMarkets.has(code) && !force)) return;
    setTranslatingMarkets(prev => new Set(prev).add(code));
    try {
      const nextListing = await performTranslation(localListing, code);
      setLocalListing(nextListing);
      onUpdate(nextListing);
      await syncToSupabase(nextListing); // Rule: Auto-sync after single translation
    } finally {
      setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(code); return n; });
    }
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
        try {
          workingListing = await performTranslation(workingListing, m.code);
          setLocalListing(workingListing);
          onUpdate(workingListing);
        } finally {
          setTranslatingMarkets(prev => { const n = new Set(prev); n.delete(m.code); return n; });
        }
        await new Promise(r => setTimeout(r, 100));
      }
      await syncToSupabase(workingListing); // Rule: Auto-sync after batch translation
    } finally { setIsTranslatingAll(false); }
  };

  const handleOptimizeMaster = async () => {
    setIsOptimizing(true);
    try {
      let opt: OptimizedData;
      // Always optimize from original cleaned data to ensure fresh results even if already optimized
      if (engine === 'openai') opt = await optimizeListingWithOpenAI(localListing.cleaned);
      else if (engine === 'deepseek') opt = await optimizeListingWithDeepSeek(localListing.cleaned);
      else opt = await optimizeListingWithAI(localListing.cleaned);
      
      const next: Listing = { ...localListing, optimized: opt, status: 'optimized' };
      setLocalListing(next); 
      onUpdate(next); 
      await syncToSupabase(next); // Rule: Auto-sync after optimization
    } finally { setIsOptimizing(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar onBack={onBack} engine={engine} setEngine={(e) => { setEngine(e); localStorage.setItem('amzbot_preferred_engine', e); }} onOptimize={handleOptimizeMaster} isOptimizing={isOptimizing} onSave={() => syncToSupabase(localListing)} isSaving={isSaving} onNext={onNext} uiLang={uiLang} />
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection listing={localListing} previewImage={previewImage} setPreviewImage={setPreviewImage} updateField={(f, v) => updateField(f, v, true)} isSaving={isSaving} isProcessing={isProcessingImages} onStandardizeAll={async () => {}} onStandardizeOne={async (u) => {}} setShowEditor={setShowImageEditor} fileInputRef={fileInputRef} />
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
                     {isTranslatingAll ? <><Loader2 size={14} className="animate-spin" /> Translating...</> : <><Languages size={14} /> AI Translate All</>}
                   </button>
                </div>
                <ListingEditorArea listing={localListing} activeMarket={activeMarket} updateField={updateField} onSync={() => syncToSupabase(localListing)} onRecalculate={() => {}} uiLang={uiLang} />
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
