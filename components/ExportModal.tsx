
import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2, Shuffle } from 'lucide-react';
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
    const { data, error } = await supabase.from('templates').select('*');
    if (!error && data) setTemplates(data);
    setLoading(false);
  };

  const cleanString = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/"/g, '""');
  };

  const generateRandomValue = (mapping: FieldMapping) => {
    if (mapping.acceptedValues && mapping.acceptedValues.length > 0) {
      return mapping.acceptedValues[Math.floor(Math.random() * mapping.acceptedValues.length)];
    }
    if (mapping.dataType?.toLowerCase().includes('number') || mapping.dataType?.toLowerCase().includes('decimal')) {
      return (Math.random() * 100).toFixed(2);
    }
    return '';
  };

  const handleExport = () => {
    if (!selectedTemplate) return;
    setExporting(true);

    try {
      const csvRows = [];
      csvRows.push(""); 
      csvRows.push("version=2023.1210"); 
      csvRows.push(`Marketplace=${selectedTemplate.marketplace || 'US'}`);
      csvRows.push(selectedTemplate.headers.join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));

      selectedListings.forEach(listing => {
        const cleaned = listing.cleaned;
        const optimized = listing.optimized;

        const row = selectedTemplate.headers.map(header => {
          const mapping = selectedTemplate.mappings?.[header];
          let value = '';

          if (mapping) {
            // 优先级 1: 映射自 Listing 字段
            if (mapping.source === 'listing') {
              const field = mapping.listingField;
              if (field === 'asin') value = listing.asin;
              else if (field === 'title') value = optimized?.optimized_title || cleaned.title;
              else if (field === 'price') value = String(cleaned.price);
              else if (field === 'brand') value = cleaned.brand;
              else if (field === 'description') value = optimized?.optimized_description || cleaned.description;
              else if (field === 'main_image') value = cleaned.main_image;
              else if (field?.startsWith('feature')) {
                const idx = parseInt(field.replace('feature', '')) - 1;
                const points = optimized?.optimized_features || cleaned.features || [];
                value = points[idx] || '';
              } else if (field === 'weight') value = cleaned.item_weight || '';
              else if (field === 'dimensions') value = cleaned.product_dimensions || '';
              
              // 如果映射值为空，回退到模板默认值
              if (!value) value = mapping.templateDefault || '';
            } 
            // 优先级 2: 使用模板第 8 行自带的默认值
            else if (mapping.source === 'template_default') {
              value = mapping.templateDefault || '';
            }
            // 优先级 3: 自定义填写值
            else if (mapping.source === 'custom') {
              value = mapping.defaultValue || '';
            }
            // 优先级 4: 随机生成符合约束的值
            else if (mapping.source === 'random') {
              value = generateRandomValue(mapping);
            }
          } else {
            // 极简兜底逻辑
            const lowerH = header.toLowerCase();
            if (lowerH.includes('sku')) value = listing.asin;
            else if (lowerH.includes('price')) value = String(cleaned.price);
          }

          return `"${cleanString(value)}"`;
        });
        csvRows.push(row.join(','));
      });

      const csvContent = "\ufeff" + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedTemplate.name}_Export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Export error: " + err.message);
    } finally {
      setTimeout(() => {
        setExporting(false);
        onClose();
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Download className="text-indigo-600" /> {t('confirmExport')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                <CheckCircle2 size={24} />
             </div>
             <div>
                <p className="text-sm font-black text-indigo-900">{selectedListings.length} {t('listings')} Selected</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Priority: Mapped > Row8 > Random</p>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('selectTemplate')}</label>
             <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto custom-scrollbar p-1">
                {loading ? <Loader2 className="animate-spin mx-auto my-10" /> : templates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10 font-bold uppercase tracking-widest">No templates available.</p>
                ) : templates.map(tmp => (
                  <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`flex items-center gap-4 p-5 rounded-[1.5rem] border text-left transition-all group ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/10' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                    <FileSpreadsheet size={24} className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-200'} />
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="font-black text-sm truncate">{tmp.name}</span>
                      <div className="flex items-center gap-3 mt-1 opacity-60">
                        <span className="text-[8px] font-black text-slate-500 uppercase">{tmp.headers.length} Cols</span>
                        {tmp.mappings && <span className="text-[8px] font-black text-indigo-500 uppercase flex items-center gap-1"><Shuffle size={8}/> Smart Rules Active</span>}
                      </div>
                    </div>
                  </button>
                ))}
             </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
           <button onClick={onClose} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">{t('cancel')}</button>
           <button 
             disabled={!selectedTemplate || exporting}
             onClick={handleExport}
             className="px-12 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-3 disabled:opacity-50 shadow-2xl active:scale-95"
           >
             {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
             {exporting ? 'Exporting...' : t('downloadCsv')}
           </button>
        </div>
      </div>
    </div>
  );
};
