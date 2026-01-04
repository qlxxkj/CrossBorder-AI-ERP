
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
      alert("Template error: Binary data missing.");
      return;
    }
    setExporting(true);

    try {
      // 1. 读取母版文件，保留样式和VBA
      const bytes = safeDecode(fileBinary);
      const workbook = XLSX.read(bytes, { type: 'array', cellStyles: true, bookVBA: true, cellNF: true, cellText: true });
      
      const tplSheetName = selectedTemplate.mappings?.['__sheet_name'] || workbook.SheetNames[workbook.SheetNames.length - 1];
      const sheet = workbook.Sheets[tplSheetName];
      
      if (!sheet) throw new Error(`Target sheet "${tplSheetName}" not found.`);

      // 2. 计算起始行
      const techRowIdx = selectedTemplate.mappings?.['__header_row_idx'] || 2;
      const hasNotice = selectedTemplate.mappings?.['__has_prefill_notice'] || false;
      
      // 数据起始行逻辑：
      // Row N: 技术行
      // Row N+1: 示例行
      // Row N+2: 可能是 Notice 或者 数据起始
      // Row N+3: 如果有 Notice，数据从这里开始
      const startDataRowIdx = techRowIdx + (hasNotice ? 3 : 2); 

      selectedListings.forEach((listing, rowOffset) => {
        const rowIdx = startDataRowIdx + rowOffset;
        const cleaned = (listing.cleaned || {}) as CleanedData;
        
        // 核心修复：内容源深度回退
        let content: OptimizedData | null = null;
        if (targetMarket === 'US' || targetMarket === 'UK') {
          content = listing.optimized || null;
        } else if (listing.translations?.[targetMarket]) {
          content = listing.translations[targetMarket];
        }
        
        // 关键回退逻辑：如果优化内容不存在或为空，强制使用 cleaned 内容
        const isContentInvalid = !content || Object.keys(content).length === 0;

        const otherImages = cleaned.other_images || [];
        const features = (!isContentInvalid && content?.optimized_features?.length) ? content.optimized_features : (cleaned.features || []);

        selectedTemplate.headers.forEach((h, colIdx) => {
          const mappingKey = `col_${colIdx}`;
          const mapping = selectedTemplate.mappings?.[mappingKey] as FieldMapping | undefined;
          if (!mapping) return;

          let val: any = "";
          if (mapping.source === 'listing') {
            const f = mapping.listingField;
            if (f === 'asin') {
              val = listing.asin || cleaned.asin || '';
            } else if (f === 'title') {
              val = (!isContentInvalid && content?.optimized_title) ? content.optimized_title : (cleaned.title || '');
            } else if (f === 'price') {
              val = cleaned.price || '';
            } else if (f === 'shipping') {
              val = cleaned.shipping || 0;
            } else if (f === 'brand') {
              val = cleaned.brand || '';
            } else if (f === 'description') {
              val = (!isContentInvalid && content?.optimized_description) ? content.optimized_description : (cleaned.description || '');
            } else if (f === 'item_weight_value') {
              val = cleaned.item_weight_value || '';
            } else if (f === 'item_weight_unit') {
              val = cleaned.item_weight_unit || '';
            } else if (f === 'item_length') {
              val = cleaned.item_length || '';
            } else if (f === 'item_width') {
              val = cleaned.item_width || '';
            } else if (f === 'item_height') {
              val = cleaned.item_height || '';
            } else if (f === 'item_size_unit') {
              val = cleaned.item_size_unit || '';
            } else if (f === 'main_image') {
              val = cleaned.main_image || '';
            } else if (f?.startsWith('other_image')) {
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
            val = Math.floor(Math.random() * 900000000 + 100000000).toString();
          }

          const finalVal = (val === undefined || val === null) ? '' : val;
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
          
          sheet[cellRef] = { 
            v: finalVal, 
            t: (typeof finalVal === 'number' && !isNaN(finalVal)) ? 'n' : 's' 
          };
        });
      });

      // 3. 更新有效范围并导出
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
    } catch (err: any) { 
      console.error("Export Error:", err);
      alert("Export failed: " + err.message); 
    } finally { 
      setExporting(false); 
      onClose(); 
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Download className="text-indigo-600" /> {t('confirmExport')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-indigo-900">{selectedListings.length} Products Selected</p>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest italic">
                Export will use the original master template as a base.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                 <Globe size={14} className="text-blue-500" /> Target Marketplace
               </label>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                 {AMAZON_MARKETPLACES.map(m => (
                   <button 
                    key={m.code} 
                    onClick={() => setTargetMarket(m.code)} 
                    className={`px-2 py-3 rounded-xl border text-left text-[10px] font-black transition-all ${targetMarket === m.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300'}`}
                   >
                     <span className="mr-1">{m.flag}</span> {m.code}
                   </button>
                 ))}
               </div>
            </div>
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                 <FileSpreadsheet size={14} className="text-emerald-500" /> Select Master Template
               </label>
               <div className="space-y-2">
                {templates.map(tmp => (
                  <button 
                    key={tmp.id} 
                    onClick={() => setSelectedTemplate(tmp)} 
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                  >
                    <FileSpreadsheet size={18} className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} />
                    <span className="font-black text-xs truncate flex-1">{tmp.name}</span>
                  </button>
                ))}
               </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">
            Cancel
          </button>
          <button 
            disabled={!selectedTemplate || exporting} 
            onClick={handleExport} 
            className="px-12 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-all disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
            {exporting ? 'Processing...' : 'Download Template Package'}
          </button>
        </div>
      </div>
    </div>
  );
};
