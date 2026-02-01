
import React, { useState, useEffect } from 'react';
import { DollarSign, Truck, ListFilter, Plus, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { Listing, OptimizedData, UILanguage, ExchangeRate, PriceAdjustment } from '../types';
import { LogisticsEditor, calculateMarketLogistics, calculateMarketPrice } from './LogisticsEditor';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';
import { translateListingWithAI } from '../services/geminiService';
import { translateListingWithOpenAI } from '../services/openaiService';
import { translateListingWithDeepSeek } from '../services/deepseekService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ListingEditorAreaProps {
  listing: Listing;
  activeMarket: string;
  setActiveMarket: (m: string) => void;
  updateListing: (updates: Partial<Listing>) => void;
  onSync: () => void;
  engine: 'gemini' | 'openai' | 'deepseek';
  uiLang: UILanguage;
}

export const ListingEditorArea: React.FC<ListingEditorAreaProps> = ({
  listing, activeMarket, setActiveMarket, updateListing, onSync, engine, uiLang
}) => {
  const isUS = activeMarket === 'US';
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateStatus, setTranslateStatus] = useState({ current: 0, total: 0 });
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>([]);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    if (!isSupabaseConfigured()) return;
    const [rRes, aRes] = await Promise.all([
      supabase.from('exchange_rates').select('*'),
      supabase.from('price_adjustments').select('*')
    ]);
    if (rRes.data) setRates(rRes.data);
    if (aRes.data) setAdjustments(aRes.data);
  };

  const translateSite = async (marketCode: string) => {
    if (!listing.optimized || isTranslating) return;
    setIsTranslating(true);
    try {
      const market = AMAZON_MARKETPLACES.find(m => m.code === marketCode);
      const targetLang = market?.name || marketCode;
      
      let translation;
      if (engine === 'openai') translation = await translateListingWithOpenAI(listing.optimized, targetLang);
      else if (engine === 'deepseek') translation = await translateListingWithDeepSeek(listing.optimized, targetLang);
      else translation = await translateListingWithAI(listing.optimized, targetLang);

      const logistics = calculateMarketLogistics(listing, marketCode);
      const priceData = calculateMarketPrice(listing, marketCode, rates, adjustments);

      const nextTrans = {
        ...(listing.translations || {}),
        [marketCode]: { ...listing.optimized, ...translation, ...logistics, ...priceData } as OptimizedData
      };
      
      updateListing({ translations: nextTrans });
    } catch (e) {
      console.error(`Translation error for ${marketCode}:`, e);
    } finally {
      setIsTranslating(false);
    }
  };

  const translateAllMarkets = async () => {
    if (!listing.optimized || isTranslating) return;
    const marketsToTranslate = AMAZON_MARKETPLACES.filter(m => m.code !== 'US');
    setIsTranslating(true);
    setTranslateStatus({ current: 0, total: marketsToTranslate.length });

    try {
      let currentTrans = { ...(listing.translations || {}) };

      for (let i = 0; i < marketsToTranslate.length; i++) {
        const m = marketsToTranslate[i];
        setTranslateStatus({ current: i + 1, total: marketsToTranslate.length });
        
        let translation;
        if (engine === 'openai') translation = await translateListingWithOpenAI(listing.optimized, m.name);
        else if (engine === 'deepseek') translation = await translateListingWithDeepSeek(listing.optimized, m.name);
        else translation = await translateListingWithAI(listing.optimized, m.name);

        const logistics = calculateMarketLogistics(listing, m.code);
        const priceData = calculateMarketPrice(listing, m.code, rates, adjustments);

        currentTrans[m.code] = { ...listing.optimized, ...translation, ...logistics, ...priceData } as OptimizedData;
      }

      updateListing({ translations: currentTrans });
    } catch (e) {
      console.error("Batch translation error:", e);
    } finally {
      setIsTranslating(false);
      setTranslateStatus({ current: 0, total: 0 });
    }
  };

  const getVal = (field: string, cleanField: string) => {
    const data = isUS ? listing.optimized : listing.translations?.[activeMarket];
    if (field === 'optimized_features') {
      const raw = data ? ((data as any).optimized_features || (data as any).features) : null;
      let res: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? raw.split('\n').filter(Boolean) : []);
      if (res.length === 0 && isUS) res = (listing.cleaned?.features || []).filter(Boolean);
      while (res.length < 5) res.push('');
      return res;
    }
    return (data ? (data as any)[field] : null) || (isUS ? (listing.cleaned as any)[cleanField] : "") || "";
  };

  const handleFieldUpdate = (field: string, value: any) => {
    if (isUS) {
      updateListing({ optimized: { ...(listing.optimized || {}), [field]: value } as any });
    } else {
      const nextTrans = { ...(listing.translations || {}) };
      nextTrans[activeMarket] = { ...(nextTrans[activeMarket] || {}), [field]: value } as any;
      updateListing({ translations: nextTrans });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 bg-slate-50/50 flex flex-wrap gap-2 border-b border-slate-100 items-center justify-between">
         <div className="flex flex-wrap gap-1.5 flex-1">
           <button onClick={() => setActiveMarket('US')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeMarket === 'US' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>🇺🇸 Master</button>
           {AMAZON_MARKETPLACES.filter(m => m.code !== 'US').map(m => {
              const isTranslated = !!listing.translations?.[m.code];
              return (
                <button key={m.code} onClick={() => { setActiveMarket(m.code); if (!isTranslated) translateSite(m.code); }} className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeMarket === m.code ? 'bg-indigo-600 text-white shadow-md' : isTranslated ? 'bg-white text-slate-500 border border-slate-200' : 'bg-white text-slate-300 border-2 border-dashed border-slate-100 opacity-60'}`}>
                  {m.flag} {m.code}
                  {activeMarket === m.code && <RefreshCw size={10} onClick={(e) => { e.stopPropagation(); translateSite(m.code); }} className="hover:rotate-180 transition-transform" />}
                </button>
              );
           })}
         </div>
         <button onClick={translateAllMarkets} disabled={isTranslating || !listing.optimized} className={`px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 shadow-xl shadow-indigo-100 transition-all ${isTranslating ? 'animate-pulse opacity-80' : 'hover:scale-105 active:scale-95'}`}>
            {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isTranslating ? `Translating ${translateStatus.current}/${translateStatus.total}` : 'Translate All'}
         </button>
      </div>

      <div className="p-10 space-y-10">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign size={14} className="text-emerald-500" /> Price ({activeMarket})</label>
            <input type="number" step="0.01" value={getVal('optimized_price', 'price')} onChange={(e) => handleFieldUpdate('optimized_price', parseFloat(e.target.value))} onBlur={onSync} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:bg-white transition-colors" />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Shipping</label>
            <input type="number" step="0.01" value={getVal('optimized_shipping', 'shipping')} onChange={(e) => handleFieldUpdate('optimized_shipping', parseFloat(e.target.value))} onBlur={onSync} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:bg-white transition-colors" />
          </div>
        </div>

        <LogisticsEditor 
          listing={listing}
          activeMarket={activeMarket}
          updateField={handleFieldUpdate}
          onSync={onSync}
          onRecalculate={() => {
            const nextLogistics = calculateMarketLogistics(listing, activeMarket);
            Object.entries(nextLogistics).forEach(([f, v]) => handleFieldUpdate(f, v));
          }}
          uiLang={uiLang}
        />

        <EditBlock label="Product Title" value={getVal('optimized_title', 'title')} onChange={v => handleFieldUpdate('optimized_title', v)} onBlur={onSync} limit={200} className="text-xl font-black" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Key Features</label>
            <button onClick={() => { const cur = getVal('optimized_features', 'features') as string[]; handleFieldUpdate('optimized_features', [...cur, '']); }} className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
              <Plus size={12} /> Add Point
            </button>
          </div>
          <div className="space-y-4">
             {(getVal('optimized_features', 'features') as string[]).map((f, i) => (
               <div key={i} className="flex gap-4 items-start group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-3 border transition-all ${f.length > 500 ? 'bg-red-600 border-red-700 text-white animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>{i+1}</div>
                  <div className="flex-1 space-y-1.5">
                    <textarea 
                      value={f || ''} 
                      onChange={e => { const cur = [...(getVal('optimized_features', 'features') as string[])]; cur[i] = e.target.value; handleFieldUpdate('optimized_features', cur); }} 
                      onBlur={onSync} 
                      className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold leading-relaxed outline-none focus:bg-white transition-all ${f.length > 500 ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200'}`} 
                      rows={2} 
                    />
                    <div className="flex justify-between items-center px-1">
                      <span className={`text-[8px] font-black uppercase ${f.length > 500 ? 'text-red-500' : 'text-slate-400'}`}>{f.length} / 500</span>
                      {i >= 5 && <button onClick={() => { const cur = (getVal('optimized_features', 'features') as string[]).filter((_, idx) => idx !== i); handleFieldUpdate('optimized_features', cur); }} className="text-[8px] font-black text-red-400 uppercase hover:text-red-600">Remove</button>}
                    </div>
                  </div>
               </div>
             ))}
          </div>
        </div>

        <EditBlock label="Description (HTML)" value={getVal('optimized_description', 'description')} onChange={v => handleFieldUpdate('optimized_description', v)} onBlur={onSync} limit={2000} isMono className="min-h-[200px] text-xs" />
        <EditBlock label="Search Keywords" value={getVal('search_keywords', 'search_keywords')} onChange={v => handleFieldUpdate('search_keywords', v)} onBlur={onSync} limit={500} className="bg-amber-50/20 border-amber-100" />
      </div>
    </div>
  );
};

const EditBlock = ({ label, value, onChange, onBlur, limit, isMono, className }: any) => {
  const isOverLimit = limit && (value?.length || 0) > limit;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        {limit && <span className={`text-[9px] font-black ${isOverLimit ? 'text-red-500' : 'text-slate-400'}`}>{value?.length || 0} / {limit}</span>}
      </div>
      <textarea 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        onBlur={onBlur} 
        className={`w-full p-6 rounded-[2rem] font-bold outline-none transition-all ${isMono ? 'font-mono' : ''} ${isOverLimit ? 'border-red-500 ring-4 ring-red-500/10 bg-white' : 'bg-slate-50 border border-slate-200 focus:bg-white'} ${className}`} 
      />
    </div>
  );
};
