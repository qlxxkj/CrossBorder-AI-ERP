
import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { Listing, ExportTemplate, UILanguage, FieldMapping, CleanedData, OptimizedData } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface ExportModalProps {
  uiLang: UILanguage;
  selectedListings: Listing[];
  onClose: () => void;
}

/**
 * 安全的 Base64 解码函数
 */
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
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
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
    const fileBinary = selectedTemplate?.mappings?.['__binary'];
    if (!selectedTemplate || !fileBinary) {
      alert(uiLang === 'zh' ? "模板数据丢失，请重新上传模板。" : "Template binary missing!");
      return;
    }
    setExporting(true);

    try {
      const bytes = safeDecode(fileBinary);
      const workbook = XLSX.read(bytes, { 
        type: 'array', 
        cellStyles: true, 
        bookVBA: true,
        cellNF: true,
        cellText: true
      });

      // 1. 获取工作表 (修复 TS 类型 literal 报错)
      const sheetNames = workbook.SheetNames;
      const tplSheetName = (sheetNames.find(n => n === 'Template') || 
                          sheetNames.find(n => n.toLowerCase() === 'template') ||
                          sheetNames.find(n => n.includes('模板')) ||
                          sheetNames[0]) as string;
      
      const sheet = workbook.Sheets[tplSheetName];
      if (!sheet) throw new Error("Target worksheet not found");

      // 2. 定位数据起始行
      // 您提到数据应该从第 8 行填充（索引 8 即 Excel 的第 9 行）
      let startDataRowIdx = 8; 
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 15; c++) {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v) {
            const val = String(cell.v).toLowerCase();
            if (val === 'sku' || val === 'item_sku' || val.includes('external_product_id')) {
              startDataRowIdx = r + 1; 
              break;
            }
          }
        }
      }

      // 3. 开始注入 Listing 数据
      selectedListings.forEach((listing, rowOffset) => {
        const rowIdx = startDataRowIdx + rowOffset;
        
        // 类型安全提取字段
        const cleaned = (listing.cleaned || {}) as CleanedData;
        const optimized = (listing.optimized || {}) as OptimizedData;
        
        const otherImages = cleaned.other_images || [];
        const features = (optimized.optimized_features && optimized.optimized_features.length > 0) 
          ? optimized.optimized_features 
          : (cleaned.features || []);

        const displayTitle = optimized.optimized_title || cleaned.title || '';
        const displayDesc = optimized.optimized_description || cleaned.description || '';

        selectedTemplate.headers.forEach((h, colIdx) => {
          const mappingKey = `col_${colIdx}`;
          const mapping = selectedTemplate.mappings?.[mappingKey] as FieldMapping | undefined;
          
          if (!mapping) return;

          let val: any = "";

          // 字段映射核心逻辑
          if (mapping.source === 'listing') {
            const f = mapping.listingField;
            if (f === 'asin') val = listing.asin;
            else if (f === 'title') val = displayTitle;
            else if (f === 'price') val = cleaned.price;
            else if (f === 'brand') val = cleaned.brand;
            else if (f === 'description') val = displayDesc;
            else if (f === 'main_image') val = cleaned.main_image;
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
            const lowH = h.toLowerCase();
            if (lowH.includes('product id') && !lowH.includes('type')) val = generateEAN();
            else val = generateRandomStr();
          }

          // 如果没有值，使用模板默认值兜底
          if (!val && mapping.templateDefault) val = mapping.templateDefault;

          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });

          /**
           * 样式保留与填充关键逻辑：
           * 我们尝试寻找“原型单元格”（通常在 startDataRowIdx 这一行）。
           * 如果模板在起始行定义了样式（背景颜色、字体），我们将其克隆。
           */
          const prototypeCellRef = XLSX.utils.encode_cell({ r: startDataRowIdx, c: colIdx });
          const prototypeCell = sheet[prototypeCellRef];

          if (prototypeCell) {
            // 原地克隆：保留 .s (style) 属性，只改值
            sheet[cellRef] = { ...prototypeCell, v: val, t: typeof val === 'number' ? 'n' : 's' };
            delete (sheet[cellRef] as any).w; // 强制重新格式化
          } else {
            // 兜底：如果原型单元格不存在，创建一个简单的单元格
            sheet[cellRef] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
          }
        });
      });

      // 4. 核心：强制更新工作表范围 (!ref)
      // 如果 !ref 不更新，Excel 会认为工作表只有表头，导致新写入的行不可见。
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      const finalMaxRow = startDataRowIdx + selectedListings.length - 1;
      const finalMaxCol = selectedTemplate.headers.length - 1;
      
      range.e.r = Math.max(range.e.r, finalMaxRow);
      range.e.c = Math.max(range.e.c, finalMaxCol);
      sheet['!ref'] = XLSX.utils.encode_range(range);

      // 5. 导出为 .xlsm (支持宏)
      const outData = XLSX.write(workbook, { 
        type: 'array', 
        bookType: 'xlsm', 
        bookVBA: true, 
        cellStyles: true,
        compression: true
      });

      const blob = new Blob([outData], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AMZ_Export_${selectedTemplate.marketplace}_${Date.now()}.xlsm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error("Export Fail:", err);
      alert(uiLang === 'zh' ? `导出失败: ${err.message}` : `Export failed: ${err.message}`);
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
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
                <p className="text-sm font-black text-indigo-900">{selectedListings.length} {t('listings')} {uiLang === 'zh' ? '项已选' : 'Selected'}</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest italic">Styles & Macros Protected</p>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('selectTemplate')}</label>
             <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto p-1 custom-scrollbar">
                {templates.length === 0 ? (
                  <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase">No templates found</p>
                  </div>
                ) : templates.map(tmp => (
                  <button 
                    key={tmp.id} 
                    onClick={() => setSelectedTemplate(tmp)} 
                    className={`flex items-center gap-4 p-5 rounded-[1.5rem] border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-500/10' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedTemplate?.id === tmp.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                       <FileSpreadsheet size={20} />
                    </div>
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="font-black text-sm truncate">{tmp.name}</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{tmp.marketplace} MARKETPLACE</span>
                    </div>
                  </button>
                ))}
             </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
           <button onClick={onClose} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
           <button 
             disabled={!selectedTemplate || exporting}
             onClick={handleExport}
             className="px-12 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 disabled:opacity-50 shadow-2xl active:scale-95 transition-all"
           >
             {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
             {exporting ? (uiLang === 'zh' ? '正在写入数据...' : 'Writing Data...') : t('downloadCsv')}
           </button>
        </div>
      </div>
    </div>
  );
};
