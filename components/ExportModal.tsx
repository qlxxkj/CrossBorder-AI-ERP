
import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2, Shuffle, Globe } from 'lucide-react';
import { Listing, ExportTemplate, UILanguage, FieldMapping } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ExportModalProps {
  uiLang: UILanguage;
  selectedListings: Listing[];
  onClose: () => void;
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
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (!error && data) setTemplates(data);
    setLoading(false);
  };

  const generateEAN = () => {
    // 前3位国家代码 (示例使用 608)
    const country = "608";
    // 4位企业码 (随机)
    const enterprise = Math.floor(1000 + Math.random() * 9000).toString();
    // 5位流水号 (随机)
    const sequence = Math.floor(10000 + Math.random() * 90000).toString();
    const base = country + enterprise + sequence;
    
    // 计算 EAN-13 校验位
    let sumOdd = 0;
    let sumEven = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(base[i]);
      if (i % 2 === 0) sumOdd += digit;
      else sumEven += digit;
    }
    const total = sumOdd + (sumEven * 3);
    const remainder = total % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    
    return base + checkDigit;
  };

  const generateRandomString = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const prefix = Array(3).fill(0).map(() => letters[Math.floor(Math.random() * letters.length)]).join('');
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    return prefix + suffix;
  };

  const handleExport = () => {
    if (!selectedTemplate) return;
    setExporting(true);

    try {
      const csvRows = [];
      // 模拟亚马逊多层表头/宏格式
      csvRows.push(""); 
      csvRows.push("version=2023.1210"); 
      csvRows.push(`Marketplace=${selectedTemplate.marketplace || 'US'}`);
      
      // 保持原始表头，不修改
      csvRows.push(selectedTemplate.headers.join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));

      selectedListings.forEach(listing => {
        const cleaned = listing.cleaned;
        const optimized = listing.optimized;
        const otherImages = cleaned.other_images || [];
        const features = optimized?.optimized_features || cleaned.features || [];

        // 首先预计算所有字段的值，以便解决字段依赖（如 Product Id 取决于 Product Id Type）
        const rowValues: Record<string, string> = {};
        
        selectedTemplate.headers.forEach((h, i) => {
          const key = `${h}_idx_${i}`;
          const mapping = selectedTemplate.mappings?.[key];
          let val = "";

          if (mapping) {
            if (mapping.source === 'listing') {
              const field = mapping.listingField;
              if (field === 'asin') val = listing.asin;
              else if (field === 'title') val = optimized?.optimized_title || cleaned.title;
              else if (field === 'price') val = String(cleaned.price);
              else if (field === 'brand') val = cleaned.brand;
              else if (field === 'description') val = optimized?.optimized_description || cleaned.description;
              else if (field === 'main_image') val = cleaned.main_image;
              else if (field?.startsWith('other_image')) {
                const match = field.match(/\d+/);
                const idx = match ? parseInt(match[0]) - 1 : -1;
                val = idx >= 0 ? (otherImages[idx] || '') : '';
              } else if (field?.startsWith('feature')) {
                const match = field.match(/\d+/);
                const idx = match ? parseInt(match[0]) - 1 : -1;
                val = idx >= 0 ? (features[idx] || '') : '';
              }
            } else if (mapping.source === 'custom') {
              val = mapping.defaultValue || '';
            } else if (mapping.source === 'template_default') {
              val = mapping.templateDefault || '';
            }
          }
          
          if (!val && mapping?.templateDefault) val = mapping.templateDefault;
          rowValues[key] = val;
        });

        // 第二轮：处理随机逻辑 (Random)
        const finalRow = selectedTemplate.headers.map((h, i) => {
          const key = `${h}_idx_${i}`;
          const mapping = selectedTemplate.mappings?.[key];
          if (mapping?.source === 'random') {
             // 特殊逻辑：如果是 Product Id 且 Product Id Type 是 EAN
             if (h.toLowerCase().includes('product id') && !h.toLowerCase().includes('type')) {
                // 寻找同一个行中的 Type 字段
                let typeVal = "";
                selectedTemplate.headers.forEach((h2, i2) => {
                   if (h2.toLowerCase().includes('product id type')) typeVal = rowValues[`${h2}_idx_${i2}`];
                });
                return typeVal?.toUpperCase() === 'EAN' ? `"${generateEAN()}"` : `"${generateRandomString()}"`;
             }
             return `"${generateRandomString()}"`;
          }
          return `"${rowValues[key].replace(/"/g, '""')}"`;
        });

        csvRows.push(finalRow.join(','));
      });

      const csvContent = "\ufeff" + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AMZ_Export_${selectedTemplate.marketplace}_${new Date().getTime()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message);
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
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600"><CheckCircle2 size={24} /></div>
             <p className="text-sm font-black text-indigo-900">{selectedListings.length} {t('listings')} Selected</p>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('selectTemplate')}</label>
             <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto p-1">
                {templates.map(tmp => (
                  <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`flex items-center gap-4 p-5 rounded-[1.5rem] border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
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
             className="px-12 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-3 disabled:opacity-50 shadow-2xl"
           >
             {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
             {exporting ? 'Exporting...' : t('downloadCsv')}
           </button>
        </div>
      </div>
    </div>
  );
};
