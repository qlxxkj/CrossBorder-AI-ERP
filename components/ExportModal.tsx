
import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2, Globe, AlertCircle, Tags, FileText, Search } from 'lucide-react';
import { Listing, ExportTemplate, UILanguage, FieldMapping, CleanedData, OptimizedData, Category, PriceAdjustment, ExchangeRate } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';
import * as XLSX from 'xlsx';

interface ExportModalProps {
  uiLang: UILanguage;
  selectedListings: Listing[];
  onClose: () => void;
  onExportSuccess?: () => void;
}

function safeDecode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const formatExportVal = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const num = parseFloat(String(val));
  if (isNaN(num)) return val;
  return parseFloat(num.toFixed(2));
};

// New Helper: Convert abbreviations to Amazon-compliant full names with capitalization
const getFullUnitName = (unit: string) => {
  if (!unit) return "";
  const normalized = unit.toLowerCase().trim();
  const map: Record<string, string> = {
    'lb': 'Pounds',
    'lbs': 'Pounds',
    'pound': 'Pounds',
    'pounds': 'Pounds',
    'kg': 'Kilograms',
    'kilogram': 'Kilograms',
    'kilograms': 'Kilograms',
    'oz': 'Ounces',
    'ounce': 'Ounces',
    'ounces': 'Ounces',
    'gr': 'Grams',
    'g': 'Grams',
    'gram': 'Grams',
    'grams': 'Grams',
    'in': 'Inches',
    'inch': 'Inches',
    'inches': 'Inches',
    'cm': 'Centimeters',
    'centimeter': 'Centimeters',
    'centimeters': 'Centimeters',
    'mm': 'Millimeters',
    'millimeter': 'Millimeters',
    'millimeters': 'Millimeters',
    'ft': 'Feet',
    'foot': 'Feet',
    'feet': 'Feet'
  };
  return map[normalized] || unit.charAt(0).toUpperCase() + unit.slice(1);
};

const IS_LATIN_MKT = (code: string) => [
  'US', 'CA', 'MX', 'BR', 'UK', 'DE', 'FR', 'IT', 'ES', 'IE', 'PL', 'NL', 'SE', 'BE', 'AU', 'SG'
].includes(code);

const generateRandomValue = (type?: 'alphanumeric' | 'ean13'): string => {
  if (type === 'ean13') {
    const country = "608";
    const manufacturer = Math.floor(Math.random() * 9000 + 1000).toString();
    const sequence = Math.floor(Math.random() * 90000 + 10000).toString();
    const base = country + manufacturer + sequence; 
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base[i]);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return base + checkDigit;
  } else {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letters = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const numbers = Math.floor(Math.random() * 9000 + 1000).toString();
    return letters + numbers;
  }
};

export const ExportModal: React.FC<ExportModalProps> = ({ uiLang, selectedListings, onClose, onExportSuccess }) => {
  const t = useTranslation(uiLang);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [targetMarket, setTargetMarket] = useState('US');
  const [targetCategory, setTargetCategory] = useState('ALL');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [mktSearch, setMktSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) return;
    const [tplRes, catRes, adjRes, rateRes] = await Promise.all([
      supabase.from('templates').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
      supabase.from('price_adjustments').select('*'),
      supabase.from('exchange_rates').select('*')
    ]);
    if (tplRes.data) setTemplates(tplRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (adjRes.data) setAdjustments(adjRes.data);
    if (rateRes.data) setExchangeRates(rateRes.data);
  };

  const filteredMarketplaces = useMemo(() => {
    return AMAZON_MARKETPLACES.filter(m => 
      m.code.toLowerCase().includes(mktSearch.toLowerCase()) || 
      m.name.toLowerCase().includes(mktSearch.toLowerCase())
    );
  }, [mktSearch]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => 
      (t.marketplace === 'ALL' || t.marketplace === targetMarket) &&
      (targetCategory === 'ALL' || t.category_id === targetCategory)
    );
  }, [templates, targetMarket, targetCategory]);

  useEffect(() => {
    if (filteredTemplates.length > 0) setSelectedTemplate(filteredTemplates[0]);
    else setSelectedTemplate(null);
  }, [filteredTemplates]);

  const updateExportHistory = async (marketCode: string) => {
    if (!isSupabaseConfigured()) return;
    try {
      const updates = selectedListings.map(listing => {
        const current = listing.exported_marketplaces || [];
        if (current.includes(marketCode)) return null;
        return supabase
          .from('listings')
          .update({ exported_marketplaces: [...current, marketCode] })
          .eq('id', listing.id);
      }).filter(Boolean);
      
      if (updates.length > 0) {
        await Promise.all(updates);
        if (onExportSuccess) onExportSuccess();
      }
    } catch (e) {
      console.error("Failed to update export history:", e);
    }
  };

  const calculateFinalPrice = (listing: Listing, targetMkt: string) => {
    let basePrice = 0;
    let baseShipping = 0;
    let needsRateConversion = true;

    const translation = listing.translations?.[targetMkt];
    if (translation && (translation.optimized_price !== undefined)) {
      basePrice = translation.optimized_price;
      baseShipping = translation.optimized_shipping || 0;
      needsRateConversion = false; 
    } else {
      basePrice = Number(listing.cleaned.price) || 0;
      baseShipping = Number(listing.cleaned.shipping) || 0;
    }

    let currentTotal = basePrice + baseShipping;

    const applicableAdj = adjustments.filter(adj => {
      const mktMatch = adj.marketplace === 'ALL' || adj.marketplace === targetMkt;
      const catMatch = adj.category_id === 'ALL' || adj.category_id === listing.category_id;
      return mktMatch && catMatch;
    });

    applicableAdj.forEach(adj => {
      const multiplier = 1 + (Number(adj.percentage) / 100);
      currentTotal *= multiplier;
    });

    if (needsRateConversion && targetMkt !== 'US') {
      const rateEntry = exchangeRates.find(r => r.marketplace === targetMkt);
      const rate = rateEntry ? Number(rateEntry.rate) : 1;
      currentTotal *= rate;
    }

    if (targetMkt === 'JP') return Math.round(currentTotal);
    return parseFloat(currentTotal.toFixed(2));
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setExportStatus('Generating CSV...');
    try {
      const allKeys = new Set<string>();
      selectedListings.forEach(l => { Object.keys(l.cleaned).forEach(k => allKeys.add(k)); });
      const headers = Array.from(allKeys);
      const csvData = selectedListings.map(l => {
        const row: Record<string, any> = {};
        headers.forEach(k => {
          let val = l.cleaned[k];
          if (Array.isArray(val)) val = val.join('; ');
          row[k] = val === undefined ? '' : val;
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(csvData, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Listings");
      const outData = XLSX.write(workbook, { bookType: 'csv', type: 'array' });
      const blob = new Blob([outData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AMZBot_Export_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      await updateExportHistory('CSV-RAW');
    } catch (err: any) { alert("CSV Export failed: " + err.message); } 
    finally { setExporting(false); onClose(); }
  };

  const handleExportTemplate = async () => {
    const fileBinary = selectedTemplate?.mappings?.['__binary'];
    if (!selectedTemplate || !fileBinary) return;
    
    setExporting(true);
    setExportStatus('Injecting Data...');

    try {
      const bytes = safeDecode(fileBinary);
      const workbook = XLSX.read(bytes, { type: 'array', cellStyles: true, bookVBA: true, cellNF: true, cellText: true });
      const tplSheetName = selectedTemplate.mappings?.['__sheet_name'] || workbook.SheetNames[0];
      const sheet = workbook.Sheets[tplSheetName];
      const techRowIdx = selectedTemplate.mappings?.['__header_row_idx'] || 4;
      const dataStartRowIdx = selectedTemplate.mappings?.['__data_start_row_idx'] || (targetMarket === 'US' ? techRowIdx + 3 : techRowIdx + 2);
      const mappingKeys = Object.keys(selectedTemplate.mappings || {}).filter(k => k.startsWith('col_'));

      selectedListings.forEach((listing, rowOffset) => {
        const rowIdx = dataStartRowIdx + rowOffset;
        const cleaned = listing.cleaned;
        const localOpt: OptimizedData | null = (targetMarket !== 'US' && listing.translations?.[targetMarket]) 
          ? listing.translations[targetMarket] 
          : (listing.optimized || null);

        mappingKeys.forEach(mappingKey => {
          const colIdx = parseInt(mappingKey.replace('col_', ''));
          const mapping = selectedTemplate.mappings?.[mappingKey] as FieldMapping | undefined;
          if (!mapping || isNaN(colIdx)) return;

          let val: any = "";
          if (mapping.source === 'listing') {
            const f = mapping.listingField;
            if (f === 'asin') val = listing.asin || cleaned.asin || '';
            else if (f === 'title') val = localOpt?.optimized_title || cleaned.title || '';
            else if (f === 'price') val = calculateFinalPrice(listing, targetMarket);
            else if (f === 'shipping') {
                const trans = listing.translations?.[targetMarket];
                if (trans && trans.optimized_shipping !== undefined) val = trans.optimized_shipping;
                else {
                    const rate = exchangeRates.find(r => r.marketplace === targetMarket)?.rate || 1;
                    const calcShip = (cleaned.shipping || 0) * (targetMarket === 'US' ? 1 : rate);
                    val = targetMarket === 'JP' ? Math.round(calcShip) : parseFloat(calcShip.toFixed(2));
                }
            }
            else if (f === 'brand') val = cleaned.brand || '';
            else if (f === 'description') val = localOpt?.optimized_description || cleaned.description || '';
            else if (f === 'main_image') val = cleaned.main_image || '';
            else if (f === 'item_weight_value') val = formatExportVal(localOpt?.optimized_weight_value || cleaned.item_weight_value || '');
            else if (f === 'item_weight_unit') {
              const unit = localOpt?.optimized_weight_unit || cleaned.item_weight_unit || '';
              // Enhanced: Use full name for template export
              val = IS_LATIN_MKT(targetMarket) ? getFullUnitName(unit) : unit;
            }
            else if (f === 'item_length') val = formatExportVal(localOpt?.optimized_length || cleaned.item_length || '');
            else if (f === 'item_width') val = formatExportVal(localOpt?.optimized_width || cleaned.item_width || '');
            else if (f === 'item_height') val = formatExportVal(localOpt?.optimized_height || cleaned.item_height || '');
            else if (f === 'item_size_unit') {
              const unit = localOpt?.optimized_size_unit || cleaned.item_size_unit || '';
              // Enhanced: Use full name for template export
              val = IS_LATIN_MKT(targetMarket) ? getFullUnitName(unit) : unit;
            }
          } else if (mapping.source === 'custom') { val = mapping.defaultValue || ''; } 
          else if (mapping.source === 'random') { val = generateRandomValue(mapping.randomType); }
          else if (mapping.source === 'template_default') { val = mapping.templateDefault || ''; }

          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
          sheet[cellRef] = { v: val, t: (typeof val === 'number') ? 'n' : 's' };
        });
      });

      const outData = XLSX.write(workbook, { type: 'array', bookType: 'xlsm', bookVBA: true, cellStyles: true });
      const blob = new Blob([outData], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Localized_${targetMarket}_${Date.now()}.xlsm`;
      link.click();
      URL.revokeObjectURL(url);
      
      await updateExportHistory(targetMarket);
    } catch (err: any) { alert("Template export failed: " + err.message); } 
    finally { setExporting(false); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-10 py-7 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
            <Download className="text-indigo-600" size={32} /> {t('confirmExport')}
          </h2>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full text-slate-400"><X size={28} /></button>
        </div>
        
        <div className="p-10 space-y-10 flex-1 overflow-y-auto custom-scrollbar">
          <div className="bg-indigo-600 p-8 rounded-[2rem] shadow-2xl shadow-indigo-200 text-white flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md"><CheckCircle2 size={32} /></div>
            <div>
              <p className="text-xl font-black">{selectedListings.length} Items Selected</p>
              <p className="text-xs font-bold text-indigo-100 opacity-80 uppercase tracking-widest mt-1">
                Updating Localization History upon completion
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5 space-y-8">
               <div className="space-y-4 flex flex-col h-full">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Globe size={14} className="text-blue-500" /> Target Marketplace</label>
                    <div className="relative group">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                      <input type="text" placeholder="Search..." value={mktSearch} onChange={(e) => setMktSearch(e.target.value)} className="pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar p-1 bg-slate-50/50 rounded-3xl border border-slate-100">
                    {filteredMarketplaces.map(m => (
                      <button key={m.code} onClick={() => setTargetMarket(m.code)} className={`px-3 py-4 rounded-2xl border text-left transition-all ${targetMarket === m.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-105 z-10' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300'}`}>
                        <div className="text-xl mb-1">{m.flag}</div>
                        <div className="text-[10px] font-black uppercase tracking-tighter truncate">{m.code} - {m.name}</div>
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            <div className="lg:col-span-7 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                  <button onClick={handleExportCSV} className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center text-center group hover:border-indigo-500 transition-all hover:bg-white hover:shadow-2xl">
                     <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm mb-6"><FileText size={32} /></div>
                     <h3 className="font-black text-slate-900 uppercase tracking-widest mb-2">Default CSV</h3>
                     <p className="text-[10px] text-slate-400 font-bold Gabriel leading-relaxed">Raw data dump without marketplace formatting.</p>
                     <div className="mt-auto px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Download</div>
                  </button>

                  <div className="space-y-4 flex flex-col h-full">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileSpreadsheet size={14} className="text-emerald-500" /> Template Export</label>
                    <div className="space-y-3 flex-1 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar bg-slate-50/30 p-4 rounded-3xl border border-slate-100">
                      {filteredTemplates.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-3xl border-dashed border-2 border-slate-100 flex flex-col items-center gap-4">
                          <AlertCircle size={32} className="text-slate-200" />
                          <p className="text-[10px] font-black text-slate-300 uppercase leading-relaxed text-center">No Templates for {targetMarket}</p>
                        </div>
                      ) : (
                        filteredTemplates.map(tmp => (
                          <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-white shadow-lg ring-1 ring-indigo-500/10' : 'border-slate-50 bg-white/70 hover:border-slate-200'}`}>
                            <div className={`p-2 rounded-lg ${selectedTemplate?.id === tmp.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}><FileSpreadsheet size={18} /></div>
                            <div className="flex-1 overflow-hidden">
                              <span className="font-black text-xs block truncate">{tmp.name}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">Cat: {categories.find(c => c.id === tmp.category_id)?.name || 'Global'}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-5">
          {exporting && <div className="mr-auto flex items-center gap-3 text-xs font-black text-indigo-600 uppercase animate-pulse"><Loader2 className="animate-spin" size={16} /> {exportStatus}</div>}
          <button onClick={onClose} className="px-10 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
          <button disabled={!selectedTemplate || exporting} onClick={handleExportTemplate} className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50">
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Localized Template (.XLSM)
          </button>
        </div>
      </div>
    </div>
  );
};
