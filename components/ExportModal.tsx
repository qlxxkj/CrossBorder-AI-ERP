
import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2, Languages, Globe } from 'lucide-react';
import { Listing, ExportTemplate, UILanguage, FieldMapping, CleanedData, OptimizedData } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';
import * as XLSX from 'xlsx';

interface ExportModalProps {
  uiLang: UILanguage;
  selectedListings: Listing[];
  onClose: () => void;
}

const TEMPLATE_SHEET_KEYWORDS = [
  'template', '模板', 'mall', 'vorlage', 'modèle', 'modelo', 
  'modello', 'plantilla', 'テンプレート', 'szablon', 'sjabloon', 'نموذج'
];

function safeDecode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const findAmazonTemplateSheet = (sheetNames: string[]): string => {
  const match = sheetNames.find(n => {
    const lower = n.toLowerCase();
    return TEMPLATE_SHEET_KEYWORDS.some(kw => lower === kw || lower.includes(kw));
  });
  if (match) return match;
  if (sheetNames.length >= 5) return sheetNames[4];
  if (sheetNames.length >= 2) return sheetNames[1];
  return sheetNames[0];
};

export const ExportModal: React.FC<ExportModalProps> = ({ uiLang, selectedListings, onClose }) => {
  const t = useTranslation(uiLang);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [targetMarket, setTargetMarket] = useState('US');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) {
      setTemplates(data);
      if (data.length > 0) setSelectedTemplate(data[0]);
    }
  };

  const handleExport = async () => {
    const fileBinary = selectedTemplate?.mappings?.['__binary'];
    if (!selectedTemplate || !fileBinary) {
      alert("Template error.");
      return;
    }
    setExporting(true);

    try {
      const bytes = safeDecode(fileBinary);
      const workbook = XLSX.read(bytes, { type: 'array', cellStyles: true, bookVBA: true, cellNF: true, cellText: true });
      
      const tplSheetName = findAmazonTemplateSheet(workbook.SheetNames);
      const sheet = workbook.Sheets[tplSheetName];
      
      // 获取模板上传时识别到的表头行索引，数据通常在其下方第 4 行开始
      const headerRowIdx = selectedTemplate.mappings?.['__header_row_idx'] || 3;
      const startDataRowIdx = headerRowIdx + 4; 

      selectedListings.forEach((listing, rowOffset) => {
        const rowIdx = startDataRowIdx + rowOffset;
        const cleaned = (listing.cleaned || {}) as CleanedData;
        
        let content: OptimizedData = listing.optimized || {} as OptimizedData;
        if (targetMarket !== 'US' && targetMarket !== 'UK' && listing.translations?.[targetMarket]) {
           content = listing.translations[targetMarket];
        }

        const otherImages = cleaned.other_images || [];
        const features = content.optimized_features?.length ? content.optimized_features : (cleaned.features || []);

        selectedTemplate.headers.forEach((h, colIdx) => {
          const mappingKey = `col_${colIdx}`;
          const mapping = selectedTemplate.mappings?.[mappingKey] as FieldMapping | undefined;
          if (!mapping) return;

          let val: any = "";
          if (mapping.source === 'listing') {
            const f = mapping.listingField;
            if (f === 'asin') val = listing.asin;
            else if (f === 'title') val = content.optimized_title || cleaned.title || '';
            else if (f === 'price') val = cleaned.price;
            else if (f === 'shipping') val = cleaned.shipping;
            else if (f === 'brand') val = cleaned.brand;
            else if (f === 'description') val = content.optimized_description || cleaned.description || '';
            else if (f === 'item_weight_value') val = cleaned.item_weight_value || '';
            else if (f === 'item_weight_unit') val = cleaned.item_weight_unit || '';
            else if (f === 'main_image') val = cleaned.main_image;
            else if (f?.startsWith('other_image')) {
              const num = parseInt(f.replace('other_image', '')) || 1;
              val = otherImages[num - 1] || '';
            } else if (f?.startsWith('feature')) {
              const num = parseInt(f.replace('feature', '')) || 1;
              val = features[num - 1] || '';
            }
          } else if (mapping.source === 'custom') { val = mapping.defaultValue || ''; }
          else if (mapping.source === 'template_default') { val = mapping.templateDefault || ''; }

          if (!val && mapping.templateDefault) val = mapping.templateDefault;
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
          sheet[cellRef] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
        });
      });

      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      range.e.r = Math.max(range.e.r, startDataRowIdx + selectedListings.length - 1);
      sheet['!ref'] = XLSX.utils.encode_range(range);

      const outData = XLSX.write(workbook, { type: 'array', bookType: 'xlsm', bookVBA: true });
      const blob = new Blob([outData], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AMZ_Export_${targetMarket}_${Date.now()}.xlsm`;
      link.click();
    } catch (err: any) { alert("Export failed: " + err.message); } finally { setExporting(false); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between"><h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Download className="text-indigo-600" /> {t('confirmExport')}</h2><button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={24} /></button></div>
        <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-4"><div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm"><CheckCircle2 size={24} /></div><div><p className="text-sm font-black text-indigo-900">{selectedListings.length} Products Selected</p><p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest italic">Ready for multi-site publishing</p></div></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Globe size={14} className="text-blue-500" /> Choose Global Marketplace</label>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                 {AMAZON_MARKETPLACES.map(m => (
                   <button key={m.code} onClick={() => setTargetMarket(m.code)} className={`px-2 py-3 rounded-xl border text-left text-[10px] font-black transition-all ${targetMarket === m.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300'}`}><span className="mr-1">{m.flag}</span> {m.code}</button>
                 ))}
               </div>
            </div>
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><FileSpreadsheet size={14} className="text-emerald-500" /> Select Listing Template</label>
               <div className="space-y-2">{templates.length === 0 ? <div className="p-10 text-center bg-slate-50 rounded-2xl border-dashed border-2 border-slate-200"><p className="text-[10px] font-black text-slate-300 uppercase">No templates</p></div> : templates.map(tmp => <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}><FileSpreadsheet size={18} className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} /><span className="font-black text-xs truncate flex-1">{tmp.name}</span></button>)}</div>
            </div>
          </div>
        </div>
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4"><button onClick={onClose} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button><button disabled={!selectedTemplate || exporting} onClick={handleExport} className="px-12 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl active:scale-95 transition-all">{exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {exporting ? 'Processing...' : 'Download Export Package'}</button></div>
      </div>
    </div>
  );
};
