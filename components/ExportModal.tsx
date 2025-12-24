
import React, { useState, useEffect } from 'react';
import { X, Download, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { Listing, ExportTemplate, UILanguage } from '../types';
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

  const handleExport = () => {
    if (!selectedTemplate) return;
    setExporting(true);

    try {
      // 1. CSV Headers
      const csvRows = [selectedTemplate.headers.join(',')];

      // 2. Data Rows
      selectedListings.forEach(listing => {
        const cleaned = listing.cleaned;
        const optimized = listing.optimized;

        const row = selectedTemplate.headers.map(header => {
          const lowerH = header.toLowerCase();
          
          // Priority 1: User-defined Default Value
          if (selectedTemplate.default_values[header]) {
            return `"${selectedTemplate.default_values[header].replace(/"/g, '""')}"`;
          }

          // Priority 2: Smart Mapping based on common Amazon internal names
          let value = '';
          
          if (lowerH.includes('item_name') || lowerH.includes('product_name') || lowerH === 'title') {
             value = optimized?.optimized_title || cleaned.title;
          } else if (lowerH.includes('item_sku') || lowerH.includes('sku') || lowerH.includes('seller_sku')) {
             value = listing.asin;
          } else if (lowerH.includes('external_product_id') || lowerH.includes('product_id')) {
             value = listing.asin;
          } else if (lowerH.includes('external_product_id_type')) {
             value = 'ASIN';
          } else if (lowerH.includes('brand_name') || lowerH === 'brand') {
             value = cleaned.brand;
          } else if (lowerH.includes('standard_price') || lowerH === 'price') {
             value = String(cleaned.price);
          } else if (lowerH.includes('product_description') || lowerH === 'description') {
             value = optimized?.optimized_description || cleaned.description;
          } else if (lowerH.includes('main_image_url') || lowerH === 'image') {
             value = cleaned.main_image;
          } else if (lowerH.includes('other_image_url1') && cleaned.other_images?.[0]) {
             value = cleaned.other_images[0];
          } else if (lowerH.includes('other_image_url2') && cleaned.other_images?.[1]) {
             value = cleaned.other_images[1];
          } else if (lowerH.includes('bullet_point')) {
             const points = optimized?.optimized_features || cleaned.features || [];
             const idxMatch = lowerH.match(/bullet_point(\d+)/);
             if (idxMatch) {
               const idx = parseInt(idxMatch[1]) - 1;
               value = points[idx] || '';
             }
          }

          return `"${(value || '').replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
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
                <p className="text-[10px] font-bold text-indigo-500 uppercase">Ready for export</p>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('selectTemplate')}</label>
             <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : templates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No templates found. Go to Template Manager.</p>
                ) : templates.map(tmp => (
                  <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}>
                    <FileSpreadsheet size={18} className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} />
                    <span className="font-bold text-sm truncate">{tmp.name}</span>
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
             className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
           >
             {exporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
             {exporting ? 'Exporting...' : t('downloadCsv')}
           </button>
        </div>
      </div>
    </div>
  );
};
