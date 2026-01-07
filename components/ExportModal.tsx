
import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2, Globe, AlertCircle, Tags, FileText } from 'lucide-react';
import { Listing, ExportTemplate, UILanguage, FieldMapping, CleanedData, OptimizedData, Category } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';
import * as XLSX from 'xlsx';

interface ExportModalProps {
  uiLang: UILanguage;
  selectedListings: Listing[];
  onClose: () => void;
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

export const ExportModal: React.FC<ExportModalProps> = ({ uiLang, selectedListings, onClose }) => {
  const t = useTranslation(uiLang);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [targetMarket, setTargetMarket] = useState('US');
  const [targetCategory, setTargetCategory] = useState('ALL');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const fetchTemplates = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

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

  const handleExportCSV = () => {
    setExporting(true);
    setExportStatus('Generating Default CSV...');
    
    try {
      const allKeys = new Set<string>();
      selectedListings.forEach(l => {
        Object.keys(l.cleaned).forEach(k => allKeys.add(k));
      });
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
      link.download = `AMZBot_DefaultExport_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("CSV Export failed: " + err.message);
    } finally {
      setExporting(false);
      onClose();
    }
  };

  const handleExportTemplate = async () => {
    const fileBinary = selectedTemplate?.mappings?.['__binary'];
    if (!selectedTemplate || !fileBinary) return;
    
    setExporting(true);
    setExportStatus('Injecting into Master...');

    try {
      const bytes = safeDecode(fileBinary);
      const workbook = XLSX.read(bytes, { type: 'array', cellStyles: true, bookVBA: true, cellNF: true, cellText: true });
      const tplSheetName = selectedTemplate.mappings?.['__sheet_name'] || workbook.SheetNames[0];
      const sheet = workbook.Sheets[tplSheetName];
      
      // 使用识别时存储的起始行索引
      // 如果没有存储（旧模板），则默认为技术行+3（US）或+2（其他）
      const techRowIdx = selectedTemplate.mappings?.['__header_row_idx'] || 4;
      const dataStartRowIdx = selectedTemplate.mappings?.['__data_start_row_idx'] || (targetMarket === 'US' ? techRowIdx + 3 : techRowIdx + 2);

      selectedListings.forEach((listing, rowOffset) => {
        const rowIdx = dataStartRowIdx + rowOffset;
        const cleaned = listing.cleaned;
        
        let opt: OptimizedData | null = null;
        if (targetMarket === 'US' || targetMarket === 'UK' || targetMarket === 'CA') opt = listing.optimized || null;
        else if (listing.translations?.[targetMarket]) opt = listing.translations[targetMarket];
        
        const isOptReady = opt && (opt.optimized_title || opt.optimized_description);

        Object.keys(selectedTemplate.mappings || {}).forEach(mappingKey => {
          if (!mappingKey.startsWith('col_')) return;
          const colIdx = parseInt(mappingKey.replace('col_', ''));
          const mapping = selectedTemplate.mappings?.[mappingKey] as FieldMapping | undefined;
          if (!mapping) return;

          let val: any = "";
          if (mapping.source === 'listing') {
            const f = mapping.listingField;
            if (f === 'asin') val = listing.asin || cleaned.asin || '';
            else if (f === 'title') val = (isOptReady ? opt?.optimized_title : cleaned.title) || cleaned.title || '';
            else if (f === 'price') val = cleaned.price || '';
            else if (f === 'shipping') val = cleaned.shipping || 0;
            else if (f === 'brand') val = cleaned.brand || '';
            else if (f === 'description') val = (isOptReady ? opt?.optimized_description : cleaned.description) || cleaned.description || '';
            else if (f === 'main_image') val = cleaned.main_image || '';
            else if (f?.startsWith('other_image')) {
              const num = parseInt(f.replace('other_image', '')) || 1;
              val = (cleaned.other_images || [])[num - 1] || '';
            } else if (f?.startsWith('feature')) {
              const num = parseInt(f.replace('feature', '')) || 1;
              const features = (isOptReady && opt?.optimized_features?.length) ? opt.optimized_features : (cleaned.features || []);
              val = features[num - 1] || '';
            }
          } else if (mapping.source === 'custom') val = mapping.defaultValue || '';
          else if (mapping.source === 'template_default') val = mapping.templateDefault || '';

          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
          if (!sheet[cellRef]) sheet[cellRef] = { v: val, t: (typeof val === 'number') ? 'n' : 's' };
          else { sheet[cellRef].v = val; sheet[cellRef].t = (typeof val === 'number') ? 'n' : 's'; }
        });
      });

      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      range.e.r = Math.max(range.e.r, dataStartRowIdx + selectedListings.length - 1);
      sheet['!ref'] = XLSX.utils.encode_range(range);

      const outData = XLSX.write(workbook, { type: 'array', bookType: 'xlsm', bookVBA: true, cellStyles: true });
      const blob = new Blob([outData], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AMZBot_TemplateExport_${targetMarket}_${Date.now()}.xlsm`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Template export failed: " + err.message);
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
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
              <p className="text-xl font-black">{selectedListings.length} Selected Items Ready</p>
              <p className="text-xs font-bold text-indigo-100 opacity-80 uppercase tracking-widest mt-1">
                Preserving VBA Macros & Custom Field Mappings
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-8">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Globe size={14} className="text-blue-500" /> Marketplace</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AMAZON_MARKETPLACES.filter(m => ['US', 'CA', 'UK', 'DE', 'FR', 'JP'].includes(m.code)).map(m => (
                      <button key={m.code} onClick={() => setTargetMarket(m.code)} className={`px-4 py-4 rounded-2xl border text-left text-xs font-black transition-all ${targetMarket === m.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300'}`}>
                        <span className="text-lg mr-2">{m.flag}</span> {m.code}
                      </button>
                    ))}
                  </div>
               </div>
               <div className="space-y-4 pt-4 border-t border-slate-50">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Tags size={14} className="text-indigo-500" /> Filter Category</label>
                  <select value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase outline-none">
                    <option value="ALL">All Categories</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
               </div>
            </div>

            <div className="lg:col-span-8 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Default Export Option */}
                  <button onClick={handleExportCSV} className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center text-center group hover:border-indigo-500 transition-all hover:bg-white hover:shadow-2xl">
                     <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm mb-6"><FileText size={32} /></div>
                     <h3 className="font-black text-slate-900 uppercase tracking-widest mb-2">Default Export</h3>
                     <p className="text-[10px] text-slate-400 font-bold leading-relaxed">Generates a CSV file containing all 'Cleaned' data fields. No mapping required.</p>
                     <div className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Download CSV</div>
                  </button>

                  {/* Template Selection */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileSpreadsheet size={14} className="text-emerald-500" /> Template Export</label>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredTemplates.length === 0 ? (
                        <div className="p-12 text-center bg-slate-50 rounded-3xl border-dashed border-2 border-slate-100"><p className="text-[10px] font-black text-slate-300 uppercase">No Templates Found</p></div>
                      ) : (
                        filteredTemplates.map(tmp => (
                          <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50 shadow-lg' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
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
          <button disabled={!selectedTemplate || exporting} onClick={handleExportTemplate} className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50">
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Template Export (.XLSM)
          </button>
        </div>
      </div>
    </div>
  );
};
