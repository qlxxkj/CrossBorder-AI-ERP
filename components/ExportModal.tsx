
import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2, Shuffle, Globe } from 'lucide-react';
import { Listing, ExportTemplate, UILanguage, FieldMapping } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
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
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
    setLoading(false);
  };

  const calculateEANCheckDigit = (base: string) => {
    let sumOdd = 0, sumEven = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base[i]);
      if (i % 2 === 0) sumOdd += digit;
      else sumEven += digit;
    }
    const total = sumOdd + (sumEven * 3);
    const remainder = total % 10;
    return remainder === 0 ? 0 : 10 - remainder;
  };

  const generateEAN = () => {
    const country = "608";
    const enterprise = Math.floor(1000 + Math.random() * 9000).toString();
    const sequence = Math.floor(10000 + Math.random() * 90000).toString();
    const base = country + enterprise + sequence;
    return base + calculateEANCheckDigit(base);
  };

  const generateRandomStr = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const prefix = Array(3).fill(0).map(() => letters[Math.floor(Math.random() * letters.length)]).join('');
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    return prefix + suffix;
  };

  const handleExport = async () => {
    // 二进制文件现在存储在 mappings['__binary'] 中
    const fileBinary = selectedTemplate?.mappings?.['__binary'];
    
    if (!selectedTemplate || !fileBinary) {
        alert("Template binary data missing from database record!");
        return;
    }
    setExporting(true);

    try {
      const bytes = safeDecode(fileBinary);

      const workbook = XLSX.read(bytes, { type: 'array', cellStyles: true, bookVBA: true });
      const tplSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'template' || n.includes('模板'));
      if (!tplSheetName) throw new Error("Template sheet not found in original file!");
      
      const sheet = workbook.Sheets[tplSheetName];

      selectedListings.forEach((listing, rowIdx) => {
        const rowNum = 8 + rowIdx;
        const cleaned = listing.cleaned;
        const optimized = listing.optimized;
        const otherImages = cleaned.other_images || [];
        const features = optimized?.optimized_features || cleaned.features || [];

        const rowData: Record<string, string> = {};
        selectedTemplate.headers.forEach((h, colIdx) => {
          const key = `col_${colIdx}`;
          const mapping = selectedTemplate.mappings?.[key] as FieldMapping | undefined;
          let val = "";

          if (mapping) {
            if (mapping.source === 'listing') {
              const f = mapping.listingField;
              if (f === 'asin') val = listing.asin;
              else if (f === 'title') val = optimized?.optimized_title || cleaned.title;
              else if (f === 'price') val = String(cleaned.price);
              else if (f === 'brand') val = cleaned.brand;
              else if (f === 'description') val = optimized?.optimized_description || cleaned.description;
              else if (f === 'main_image') val = cleaned.main_image;
              else if (f?.startsWith('other_image')) {
                const idx = parseInt(f.match(/\d+/)?.[0] || "1") - 1;
                val = otherImages[idx] || '';
              } else if (f?.startsWith('feature')) {
                const idx = parseInt(f.match(/\d+/)?.[0] || "1") - 1;
                val = features[idx] || '';
              }
            } else if (mapping.source === 'custom') {
              val = mapping.defaultValue || '';
            } else if (mapping.source === 'template_default') {
              val = mapping.templateDefault || '';
            }
          }
          if (!val && mapping?.templateDefault) val = mapping.templateDefault;
          rowData[key] = val;
        });

        selectedTemplate.headers.forEach((h, colIdx) => {
          const key = `col_${colIdx}`;
          const mapping = selectedTemplate.mappings?.[key] as FieldMapping | undefined;
          let finalVal = rowData[key];

          if (mapping?.source === 'random') {
            if (h.toLowerCase().includes('product id') && !h.toLowerCase().includes('type')) {
              let typeVal = "";
              selectedTemplate.headers.forEach((h2, colIdx2) => {
                if (h2.toLowerCase().includes('product id type')) typeVal = rowData[`col_${colIdx2}`];
              });
              finalVal = typeVal?.toUpperCase() === 'EAN' ? generateEAN() : generateRandomStr();
            } else {
              finalVal = generateRandomStr();
            }
          }

          const cellRef = XLSX.utils.encode_cell({ r: rowNum, c: colIdx });
          sheet[cellRef] = { v: finalVal, t: 's' };
        });
      });

      const outData = XLSX.write(workbook, { type: 'array', bookType: 'xlsm', bookSST: false });
      const blob = new Blob([outData], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Export_${selectedTemplate.marketplace}_${Date.now()}.xlsm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Download className="text-indigo-600" /> {t('confirmExport')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={24} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                <CheckCircle2 size={24} />
             </div>
             <div>
                <p className="text-sm font-black text-indigo-900">{selectedListings.length} {t('listings')} Selected</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Original Excel Format Preserved</p>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('selectTemplate')}</label>
             <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto p-1">
                {templates.map(tmp => (
                  <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`flex items-center gap-4 p-5 rounded-[1.5rem] border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-500/10' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="font-black text-sm truncate">{tmp.name}</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase">{tmp.marketplace}</span>
                    </div>
                  </button>
                ))}
             </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
           <button onClick={onClose} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase">Cancel</button>
           <button 
             disabled={!selectedTemplate || exporting}
             onClick={handleExport}
             className="px-12 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-3 disabled:opacity-50 shadow-2xl active:scale-95 transition-all"
           >
             {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
             {exporting ? 'Exporting...' : t('downloadCsv')}
           </button>
        </div>
      </div>
    </div>
  );
};
