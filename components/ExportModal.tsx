
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

  // 生成随机值的工具函数
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
            if (mapping.source === 'listing' || mapping.source === 'random') {
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
              else if (field === 'other_image1') value = cleaned.other_images?.[0] || '';

              // 如果字段为空且开启了随机生成
              if (!value && mapping.source === 'random') {
                value = generateRandomValue(mapping);
              }
            } else {
              value = mapping.defaultValue || '';
            }
          } else {
            // 兜底逻辑：尝试传统映射
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
      alert("Export failed: " + err.message);
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
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Download className="text-indigo-600" /> {t('confirmExport')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24} /></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-4">
             <CheckCircle2 size={24} className="text-indigo-600" />
             <div>
                <p className="text-sm font-black text-indigo-900">{selectedListings.length} {t('listings')} Selected</p>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Smart Field Mapping Active</p>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('selectTemplate')}</label>
             <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : templates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No templates found.</p>
                ) : templates.map(tmp => (
                  <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}>
                    <FileSpreadsheet size={18} className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} />
                    <div className="flex flex-col flex-1">
                      <span className="font-black text-sm truncate">{tmp.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{tmp.headers.length} Columns</span>
                        {tmp.mappings && <span className="text-[8px] font-bold text-indigo-500 uppercase flex items-center gap-1"><Shuffle size={8}/> Smart Mapped</span>}
                      </div>
                    </div>
                  </button>
                ))}
             </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
           <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase">{t('cancel')}</button>
           <button 
             disabled={!selectedTemplate || exporting}
             onClick={handleExport}
             className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl"
           >
             {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
             {exporting ? 'Exporting...' : t('downloadCsv')}
           </button>
        </div>
      </div>
    </div>
  );
};
