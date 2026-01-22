
import React from 'react';
import { DollarSign, Truck, ListFilter, Plus } from 'lucide-react';
import { Listing, OptimizedData, UILanguage } from '../types';
import { LogisticsEditor } from './LogisticsEditor';

interface ListingEditorAreaProps {
  listing: Listing;
  activeMarket: string;
  updateField: (field: string, value: any) => void;
  onSync: () => void;
  onRecalculate: () => void;
  uiLang: UILanguage;
}

export const ListingEditorArea: React.FC<ListingEditorAreaProps> = ({
  listing, activeMarket, updateField, onSync, onRecalculate, uiLang
}) => {
  const isUS = activeMarket === 'US';
  
  const getVal = (optField: string, cleanField: string) => {
    const data = isUS ? listing.optimized : listing.translations?.[activeMarket];
    
    if (optField === 'optimized_features') {
      const raw = data ? ((data as any).optimized_features || (data as any).features || (data as any).bullet_points) : null;
      let res: string[] = [];
      if (Array.isArray(raw)) res = raw.map(f => String(f || ""));
      else if (typeof raw === 'string') res = raw.split('\n').filter(Boolean);
      if (res.length === 0 && isUS) res = (listing.cleaned?.bullet_points || listing.cleaned?.features || []).filter(Boolean);
      while (res.length < 5) res.push('');
      return res;
    }
    return (data ? (data as any)[optField] : null) || (isUS ? (listing.cleaned as any)[cleanField] : "") || "";
  };

  return (
    <div className="p-10 space-y-10">
      {/* 价格与运费区 */}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><DollarSign size={14} className="text-emerald-500" /> Price ({activeMarket})</label>
          <input type="number" step="0.01" value={getVal('optimized_price', 'price')} onChange={(e) => updateField('optimized_price', parseFloat(e.target.value))} onBlur={onSync} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:bg-white transition-colors" />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> Shipping</label>
          <input type="number" step="0.01" value={getVal('optimized_shipping', 'shipping')} onChange={(e) => updateField('optimized_shipping', parseFloat(e.target.value))} onBlur={onSync} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:bg-white transition-colors" />
        </div>
      </div>

      {/* 独立物流规格编辑器 */}
      <LogisticsEditor 
        listing={listing}
        activeMarket={activeMarket}
        updateField={updateField}
        onSync={onSync}
        onRecalculate={onRecalculate}
        uiLang={uiLang}
      />

      <EditBlock label="Product Title" value={getVal('optimized_title', 'title')} onChange={v => updateField('optimized_title', v)} onBlur={onSync} limit={200} className="text-xl font-black" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListFilter size={14} /> Key Features (Bullets)</label>
          <button onClick={() => { const cur = getVal('optimized_features', 'features') as string[]; if (cur.length < 10) updateField('optimized_features', [...cur, '']); }} className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
            <Plus size={12} /> Add Point
          </button>
        </div>
        <div className="space-y-4">
           {(getVal('optimized_features', 'features') as string[]).map((f, i) => (
             <div key={i} className="flex gap-4 items-start group">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-3 border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</div>
                <div className="flex-1 space-y-1.5">
                  <textarea value={f || ''} onChange={e => { const cur = [...(getVal('optimized_features', 'features') as string[])]; cur[i] = e.target.value; updateField('optimized_features', cur); }} onBlur={onSync} className={`w-full p-4 bg-slate-50 border ${f.length > 500 ? 'border-red-400' : 'border-slate-200'} rounded-2xl text-sm font-bold leading-relaxed outline-none focus:bg-white transition-all`} rows={2} />
                  <div className="flex justify-between items-center px-1">
                    <span className={`text-[8px] font-black uppercase ${f.length > 480 ? 'text-red-500' : 'text-slate-400'}`}>{f.length} / 500</span>
                    {i >= 5 && <button onClick={() => { const cur = (getVal('optimized_features', 'features') as string[]).filter((_, idx) => idx !== i); updateField('optimized_features', cur); }} className="text-[8px] font-black text-red-400 uppercase hover:text-red-600">Remove</button>}
                  </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      <EditBlock label="Description (HTML)" value={getVal('optimized_description', 'description')} onChange={v => updateField('optimized_description', v)} onBlur={onSync} limit={2000} isMono className="min-h-[200px] text-xs" />
      <EditBlock label="Search Keywords" value={getVal('search_keywords', 'search_keywords')} onChange={v => updateField('search_keywords', v)} onBlur={onSync} limit={250} className="bg-amber-50/20 border-amber-100" />
    </div>
  );
};

const EditBlock = ({ label, value, onChange, onBlur, limit, isMono, className }: any) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      {limit && <span className={`text-[9px] font-black ${(value || '').length > limit ? 'text-red-500' : 'text-slate-400'}`}>{(value || '').length} / {limit}</span>}
    </div>
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} onBlur={onBlur} className={`w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold outline-none focus:bg-white transition-all ${isMono ? 'font-mono' : ''} ${className}`} />
  </div>
);
