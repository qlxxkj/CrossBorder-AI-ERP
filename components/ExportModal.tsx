
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
  const [targetMarket, setTargetMarket] = useState('US');
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

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
      alert("Error: Template binary data missing. Please re-upload the template in Template Manager.");
      return;
    }
    setExporting(true);
    setExportStatus('Reading master file...');

    try {
      const bytes = safeDecode(fileBinary);
      // 重要：必须开启 cellStyles 和 bookVBA 以尽量保留宏和部分样式
      const workbook = XLSX.read(bytes, { 
        type: 'array', 
        cellStyles: true, 
        bookVBA: true, 
        cellNF: true, 
        cellText: true,
        bookDeps: true
      });
      
      const tplSheetName = selectedTemplate.mappings?.['__sheet_name'] || workbook.SheetNames[0];
      const sheet = workbook.Sheets[tplSheetName];
      if (!sheet) throw new Error(`Target sheet "${tplSheetName}" not found in template.`);

      // 计算起始行 (技术行 Row 5 -> Index 4)
      const techRowIdx = selectedTemplate.mappings?.['__header_row_idx'] || 4;
      const hasNotice = selectedTemplate.mappings?.['__has_prefill_notice'] || false;
      const startDataRowIdx = techRowIdx + (hasNotice ? 3 : 2); 

      setExportStatus(`Injecting ${selectedListings.length} products starting at Row ${startDataRowIdx + 1}...`);

      selectedListings.forEach((listing, rowOffset) => {
        const rowIdx = startDataRowIdx + rowOffset;
        const cleaned = (listing.cleaned || {}) as CleanedData;
        
        // 关键：多层数据兜底逻辑
        let opt: OptimizedData | null = null;
        if (targetMarket === 'US' || targetMarket === 'UK' || targetMarket === 'CA') {
          opt = listing.optimized || null;
        } else if (listing.translations?.[targetMarket]) {
          opt = listing.translations[targetMarket];
        }
        
        const isOptValid = opt && (opt.optimized_title || opt.optimized_description);

        const otherImages = cleaned.other_images || [];
        const features = (isOptValid && opt?.optimized_features?.length) ? opt.optimized_features : (cleaned.features || []);

        // 遍历所有映射过的列
        Object.keys(selectedTemplate.mappings || {}).forEach(mappingKey => {
          if (!mappingKey.startsWith('col_')) return;
          const colIdx = parseInt(mappingKey.replace('col_', ''));
          const mapping = selectedTemplate.mappings?.[mappingKey] as FieldMapping | undefined;
          if (!mapping) return;

          let val: any = "";
          if (mapping.source === 'listing') {
            const f = mapping.listingField;
            if (f === 'asin') val = listing.asin || cleaned.asin || '';
            else if (f === 'title') val = (isOptValid ? opt?.optimized_title : cleaned.title) || '';
            else if (f === 'price') val = cleaned.price || '';
            else if (f === 'shipping') val = cleaned.shipping || 0;
            else if (f === 'brand') val = cleaned.brand || '';
            else if (f === 'description') val = (isOptValid ? opt?.optimized_description : cleaned.description) || '';
            else if (f === 'item_weight_value') val = cleaned.item_weight_value || '';
            else if (f === 'item_weight_unit') val = cleaned.item_weight_unit || '';
            else if (f === 'item_length') val = cleaned.item_length || '';
            else if (f === 'item_width') val = cleaned.item_width || '';
            else if (f === 'item_height') val = cleaned.item_height || '';
            else if (f === 'item_size_unit') val = cleaned.item_size_unit || '';
            else if (f === 'main_image') val = cleaned.main_image || '';
            else if (f?.startsWith('other_image')) {
              const num = parseInt(f.replace('other_image', '')) || 1;
              val = otherImages[num - 1] || '';
            } else if (f?.startsWith('feature')) {
              const num = parseInt(f.replace('feature', '')) || 1;
              val = features[num - 1] || '';
            }
          } else if (mapping.source === 'custom') { 
            val = mapping.defaultValue || ''; 
          } else if (mapping.source === 'template_default') {
            val = mapping.templateDefault || '';
          } else if (mapping.source === 'random') {
            val = "SKU-" + Math.floor(Math.random() * 900000 + 100000).toString();
          }

          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
          const cellValue = (val === undefined || val === null) ? '' : val;
          
          // 原位写入以保持单元格原有对象中的样式属性（虽然社区版 XLSX 限制较大）
          if (!sheet[cellRef]) {
            sheet[cellRef] = { v: cellValue, t: (typeof cellValue === 'number') ? 'n' : 's' };
          } else {
            sheet[cellRef].v = cellValue;
            sheet[cellRef].t = (typeof cellValue === 'number') ? 'n' : 's';
          }
        });
      });

      // 更新 Sheet 范围
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      range.e.r = Math.max(range.e.r, startDataRowIdx + selectedListings.length - 1);
      sheet['!ref'] = XLSX.utils.encode_range(range);

      setExportStatus('Finalizing XLSM binary...');

      // 以二进制 xlsm 格式写回
      const outData = XLSX.write(workbook, { 
        type: 'array', 
        bookType: 'xlsm', 
        bookVBA: true,
        cellStyles: true 
      });
      
      const blob = new Blob([outData], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AMZ_Export_${targetMarket}_${Date.now()}.xlsm`;
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus('Download complete!');
    } catch (err: any) { 
      console.error("Export System Failure:", err);
      alert("Export failed: " + err.message); 
    } finally { 
      setExporting(false); 
      onClose(); 
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-10 py-7 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
            <Download className="text-indigo-600" size={32} /> {t('confirmExport')}
          </h2>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={28} />
          </button>
        </div>
        
        <div className="p-10 space-y-10 flex-1 overflow-y-auto custom-scrollbar">
          <div className="bg-indigo-600 p-8 rounded-[2rem] shadow-2xl shadow-indigo-200 text-white flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <p className="text-xl font-black">{selectedListings.length} Products for Global Launch</p>
              <p className="text-xs font-bold text-indigo-100 opacity-80 uppercase tracking-widest mt-1">
                Integrity Mode: Data Start Row {selectedTemplate?.mappings?.__has_prefill_notice ? '8' : '7'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                 <Globe size={14} className="text-blue-500" /> Marketplace
               </label>
               <div className="grid grid-cols-2 gap-2">
                 {AMAZON_MARKETPLACES.filter(m => ['US', 'CA', 'UK', 'DE', 'FR', 'JP'].includes(m.code)).map(m => (
                   <button 
                    key={m.code} 
                    onClick={() => setTargetMarket(m.code)} 
                    className={`px-4 py-4 rounded-2xl border text-left text-xs font-black transition-all ${targetMarket === m.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300'}`}
                   >
                     <span className="text-lg mr-2">{m.flag}</span> {m.code}
                   </button>
                 ))}
               </div>
            </div>
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                 <FileSpreadsheet size={14} className="text-emerald-500" /> Master Template
               </label>
               <div className="space-y-3">
                {templates.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 rounded-3xl border-dashed border-2 border-slate-200">
                    <p className="text-xs font-black text-slate-300 uppercase">No templates loaded</p>
                  </div>
                ) : (
                  templates.map(tmp => (
                    <button 
                      key={tmp.id} 
                      onClick={() => setSelectedTemplate(tmp)} 
                      className={`w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50 shadow-lg' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                    >
                      <div className={`p-2 rounded-lg ${selectedTemplate?.id === tmp.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <FileSpreadsheet size={20} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <span className="font-black text-sm block truncate">{tmp.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Row {tmp.mappings?.__header_row_idx + 1} Header</span>
                      </div>
                    </button>
                  ))
                )}
               </div>
            </div>
          </div>
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-5">
          {exporting && (
            <div className="mr-auto flex items-center gap-3 text-xs font-black text-indigo-600 uppercase animate-pulse">
              <Loader2 className="animate-spin" size={16} /> {exportStatus}
            </div>
          )}
          <button onClick={onClose} className="px-10 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">
            Cancel
          </button>
          <button 
            disabled={!selectedTemplate || exporting} 
            onClick={handleExport} 
            className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 
            {exporting ? 'Exporting...' : 'Start Global Launch'}
          </button>
        </div>
      </div>
    </div>
  );
};
