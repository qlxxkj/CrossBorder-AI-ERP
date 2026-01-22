
import React from 'react';
import { DollarSign, Truck, Box, Scale, ImageIcon, ListFilter, Plus, FileText, Hash } from 'lucide-react';
import { Listing, OptimizedData, UILanguage } from '../types';

interface ListingEditorAreaProps {
  listing: Listing;
  activeMarket: string;
  updateField: (field: string, value: any) => void;
  onSync: () => void;
  onRecalculate: () => void;
  uiLang: UILanguage;
}

/**
 * 核心单位本地化标准函数
 * 确保符合亚马逊官方模板：拉丁语站点首字母大写，其他小写
 */
const getLocalizedUnit = (unit: string | undefined, market: string) => {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  
  // 1. 日本站 (JP) - 片假名全拼
  if (market === 'JP') {
    const jpMap: Record<string, string> = { 
      'kg': 'キログラム', 'kilogram': 'キログラム', 'kilograms': 'キログラム',
      'cm': 'センチメートル', 'centimeter': 'センチメートル', 'centimeters': 'センチメートル',
      'lb': 'ポンド', 'pound': 'ポンド', 'pounds': 'ポンド',
      'in': 'インチ', 'inch': 'インチ', 'inches': 'インチ'
    };
    return jpMap[u] || unit;
  }

  // 2. 拉美/西语站点 (MX/BR/ES) - 全拼 Sentence Case
  if (['MX', 'BR', 'ES'].includes(market)) {
    const latinExtMap: Record<string, string> = {
      'kg': 'Kilogramos', 'kilogram': 'Kilogramos', 'kilograms': 'Kilogramos',
      'cm': 'Centímetros', 'centimeter': 'Centímetros', 'centimeters': 'Centímetros',
      'lb': 'Libras', 'pound': 'Libras', 'pounds': 'Libras',
      'in': 'Pulgadas', 'inch': 'Pulgadas', 'inches': 'Pulgadas'
    };
    return latinExtMap[u] || (unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase());
  }

  // 3. 阿拉伯站点 (EG/SA/AE) - 阿语全拼
  if (['EG', 'SA', 'AE'].includes(market)) {
    const arMap: Record<string, string> = { 
      'kg': 'كيلوجرام', 'kilogram': 'كيلوجرام', 'kilograms': 'كيلوجرام',
      'cm': 'سنتيمتر', 'centimeter': 'سنتيمتر', 'centimeters': 'سنتيمتر',
      'lb': 'رطل', 'pound': 'رطل', 'pounds': 'رطل',
      'in': 'بوصة', 'inch': 'بوصة', 'inches': 'بوصة'
    };
    return arMap[u] || unit;
  }

  // 4. 标准拉丁语系 (US, UK, CA, DE, FR etc.) - 强制 Sentence Case
  const latinMap: Record<string, string> = {
    'kg': 'Kilograms', 'kilogram': 'Kilograms', 'kilograms': 'Kilograms',
    'cm': 'Centimeters', 'centimeter': 'Centimeters', 'centimeters': 'Centimeters',
    'lb': 'Pounds', 'pound': 'Pounds', 'pounds': 'Pounds',
    'in': 'Inches', 'inch': 'Inches', 'inches': 'Inches'
  };

  if (latinMap[u]) return latinMap[u];
  // 兜底处理：首字母大写
  return unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
};

export const ListingEditorArea: React.FC<ListingEditorAreaProps> = ({
  listing, activeMarket, updateField, onSync, onRecalculate, uiLang
}) => {
  const isUS = activeMarket === 'US';
  
  const getVal = (optField: string, cleanField: string) => {
    const data = isUS ? listing.optimized : listing.translations?.[activeMarket];
    
    // 特殊处理单位本地化显示映射
    if (optField === 'optimized_weight_unit' || optField === 'optimized_size_unit') {
      const rawUnit = (data ? (data as any)[optField] : null) || (isUS ? (listing.cleaned as any)[cleanField] : "");
      return getLocalizedUnit(rawUnit, activeMarket);
    }

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

      {/* 物流规格区 - 比例优化与单位显示修复 */}
      <div className="bg-slate-50/50 px-10 py-8 rounded-[2.5rem] border border-slate-100 space-y-8">
        <div className="flex items-center justify-between">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Box size={14} /> Logistics Specifications</h3>
           {!isUS && (
             <button onClick={onRecalculate} className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 uppercase bg-white px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
               <Scale size={12} /> Auto Recalculate & Localize
             </button>
           )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* 重量：数值框适中，单位框 w-32 对齐 */}
           <div className="space-y-3 min-w-0">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">Item Weight</label>
              <div className="flex gap-3 w-full">
                 <input value={getVal('optimized_weight_value', 'item_weight_value')} onChange={e => updateField('optimized_weight_value', e.target.value)} onBlur={onSync} className="flex-1 min-w-0 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="0.00" />
                 <input value={getVal('optimized_weight_unit', 'item_weight_unit')} onChange={e => updateField('optimized_weight_unit', e.target.value)} onBlur={onSync} className="w-32 shrink-0 px-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-[11px] text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="Unit" />
              </div>
           </div>
           
           {/* 尺寸：加宽数值框 (flex-[1.5]) */}
           <div className="space-y-3 min-w-0">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">Dimensions (L × W × H)</label>
              <div className="flex gap-2 w-full">
                 <input value={getVal('optimized_length', 'item_length')} onChange={e => updateField('optimized_length', e.target.value)} onBlur={onSync} className="flex-[1.5] min-w-0 px-3 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="L" />
                 <input value={getVal('optimized_width', 'item_width')} onChange={e => updateField('optimized_width', e.target.value)} onBlur={onSync} className="flex-[1.5] min-w-0 px-3 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="W" />
                 <input value={getVal('optimized_height', 'item_height')} onChange={e => updateField('optimized_height', e.target.value)} onBlur={onSync} className="flex-[1.5] min-w-0 px-3 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="H" />
                 <input value={getVal('optimized_size_unit', 'item_size_unit')} onChange={e => updateField('optimized_size_unit', e.target.value)} onBlur={onSync} className="w-32 shrink-0 px-2 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-[11px] text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="Unit" />
              </div>
           </div>
        </div>
      </div>

      {/* 标题 */}
      <EditBlock label="Product Title" value={getVal('optimized_title', 'title')} onChange={v => updateField('optimized_title', v)} onBlur={onSync} limit={200} className="text-xl font-black" />

      {/* 五点描述 */}
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
