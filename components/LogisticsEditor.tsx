
import React from 'react';
import { Box, Scale } from 'lucide-react';
import { Listing, UILanguage } from '../types';

interface LogisticsEditorProps {
  listing: Listing;
  activeMarket: string;
  updateField: (field: string, value: any) => void;
  onSync: () => void;
  onRecalculate: () => void;
  uiLang: UILanguage;
}

/**
 * 亚马逊 18 个站点物流单位本地化字典 (Sentence Case 全称)
 */
export const getLocalizedUnit = (unit: string | undefined, market: string) => {
  if (!unit) return '';
  const u = unit.toLowerCase().trim();
  
  // 1. 日本 (JP)
  if (market === 'JP') {
    const jp: Record<string, string> = { 
      'kg': 'キログラム', 'kilogram': 'キログラム', 
      'cm': 'センチメートル', 'centimeter': 'センチメートル', 
      'lb': 'ポンド', 'in': 'インチ', 'oz': 'オンス', 'g': 'グラム' 
    };
    return jp[u] || unit;
  }

  // 2. 德语 (DE)
  if (market === 'DE') {
    const de: Record<string, string> = {
      'kg': 'Kilogramm', 'kilogram': 'Kilogramm',
      'cm': 'Zentimeter', 'centimeter': 'Zentimeter',
      'lb': 'Pfund', 'oz': 'Unze'
    };
    return de[u] || unit;
  }

  // 3. 法语/比利时 (FR, BE)
  if (['FR', 'BE'].includes(market)) {
    const fr: Record<string, string> = {
      'kg': 'Kilogrammes', 'kilogram': 'Kilogrammes',
      'cm': 'Centimètres', 'centimeter': 'Centimètres',
      'lb': 'Livres', 'oz': 'Onces'
    };
    return fr[u] || unit;
  }

  // 4. 意大利 (IT)
  if (market === 'IT') {
    const it: Record<string, string> = {
      'kg': 'Chilogrammi', 'kilogram': 'Chilogrammi',
      'cm': 'Centimetri', 'centimeter': 'Centimetri',
      'lb': 'Libbre'
    };
    return it[u] || unit;
  }

  // 5. 波兰 (PL)
  if (market === 'PL') {
    const pl: Record<string, string> = {
      'kg': 'Kilogramy', 'kilogram': 'Kilogramy',
      'cm': 'Centymetry', 'centimeter': 'Centymetry'
    };
    return pl[u] || unit;
  }

  // 6. 墨西哥/西班牙 (MX, ES)
  if (['MX', 'ES'].includes(market)) {
    const es: Record<string, string> = { 
      'kg': 'Kilogramos', 'cm': 'Centímetros', 
      'lb': 'Libras', 'in': 'Pulgadas'
    };
    return es[u] || unit;
  }

  // 7. 巴西 (BR) - 葡语
  if (market === 'BR') {
    const pt: Record<string, string> = {
      'kg': 'Quilogramas', 'cm': 'Centímetros',
      'lb': 'Libras'
    };
    return pt[u] || unit;
  }
  
  // 8. 阿拉伯语站点 (EG, SA, AE)
  if (['EG', 'SA', 'AE'].includes(market)) {
    const ar: Record<string, string> = { 
      'kg': 'كيلوجرام', 'cm': 'سنتيمتر', 
      'lb': 'رطل', 'in': 'بوصة', 'oz': 'أوقية'
    };
    return ar[u] || unit;
  }

  // 9. 荷兰 (NL)
  if (market === 'NL') {
     const nl: Record<string, string> = { 'kg': 'Kilogram', 'cm': 'Centimeter' };
     return nl[u] || unit;
  }

  // 10. 瑞典 (SE)
  if (market === 'SE') {
     const se: Record<string, string> = { 'kg': 'Kilogram', 'cm': 'Centimeter' };
     return se[u] || unit;
  }
  
  // 11. 欧美/英语通用 (US, UK, CA, AU, SG, IE)
  const latin: Record<string, string> = {
    'kg': 'Kilograms', 'kilogram': 'Kilograms', 'kilograms': 'Kilograms',
    'cm': 'Centimeters', 'centimeter': 'Centimeters', 'centimeters': 'Centimeters',
    'lb': 'Pounds', 'pound': 'Pounds', 'pounds': 'Pounds',
    'in': 'Inches', 'inch': 'Inches', 'inches': 'Inches',
    'oz': 'Ounces', 'ounce': 'Ounces', 'ounces': 'Ounces',
    'g': 'Grams', 'gram': 'Grams', 'grams': 'Grams'
  };
  if (latin[u]) return latin[u];
  
  // 默认 Sentence Case
  return unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase();
};

export const LogisticsEditor: React.FC<LogisticsEditorProps> = ({
  listing, activeMarket, updateField, onSync, onRecalculate, uiLang
}) => {
  const isUS = activeMarket === 'US';
  const data = isUS ? listing.optimized : listing.translations?.[activeMarket];

  const getLogisticsVal = (optField: string, cleanField: string) => {
    if (optField === 'optimized_weight_unit' || optField === 'optimized_size_unit') {
      const rawUnit = (data ? (data as any)[optField] : null) || (isUS ? (listing.cleaned as any)[cleanField] : "");
      return getLocalizedUnit(rawUnit, activeMarket);
    }
    return (data ? (data as any)[optField] : null) || (isUS ? (listing.cleaned as any)[cleanField] : "") || "";
  };

  return (
    <div className="bg-slate-50/50 px-10 py-8 rounded-[2.5rem] border border-slate-100 shadow-inner space-y-8">
      <div className="flex items-center justify-between">
         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Box size={14} /> Logistics Specifications</h3>
         {!isUS && (
           <button onClick={onRecalculate} className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 uppercase bg-white px-4 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
             <Scale size={12} /> Force Recalculate from Master
           </button>
         )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
         <div className="space-y-3 min-w-0">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">Item Weight</label>
            <div className="flex gap-3 w-full">
               <input 
                value={getLogisticsVal('optimized_weight_value', 'item_weight_value')} 
                onChange={e => updateField('optimized_weight_value', e.target.value)} 
                onBlur={onSync} 
                className="flex-1 min-w-0 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                placeholder="0.00" 
               />
               <input 
                value={getLogisticsVal('optimized_weight_unit', 'item_weight_unit')} 
                onChange={e => updateField('optimized_weight_unit', e.target.value)} 
                onBlur={onSync} 
                className="min-w-[150px] flex-1 px-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-[11px] text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                placeholder="Unit" 
               />
            </div>
         </div>
         
         <div className="space-y-3 min-w-0">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">Dimensions (L × W × H)</label>
            <div className="flex gap-2 w-full">
               <input value={getLogisticsVal('optimized_length', 'item_length')} onChange={e => updateField('optimized_length', e.target.value)} onBlur={onSync} className="flex-[3] min-w-0 px-3 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="L" />
               <input value={getLogisticsVal('optimized_width', 'item_width')} onChange={e => updateField('optimized_width', e.target.value)} onBlur={onSync} className="flex-[3] min-w-0 px-3 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="W" />
               <input value={getLogisticsVal('optimized_height', 'item_height')} onChange={e => updateField('optimized_height', e.target.value)} onBlur={onSync} className="flex-[3] min-w-0 px-3 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="H" />
               <input value={getLogisticsVal('optimized_size_unit', 'item_size_unit')} onChange={e => updateField('optimized_size_unit', e.target.value)} onBlur={onSync} className="min-w-[150px] flex-1 px-2 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-[11px] text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="Unit" />
            </div>
         </div>
      </div>
    </div>
  );
};
