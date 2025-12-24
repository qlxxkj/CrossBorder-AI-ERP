
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

    // Simple Mapping logic
    const csvContent = [
      selectedTemplate.headers.join(','), // Headers
      ...selectedListings.map(listing => {
        const row = selectedTemplate.headers.map(header => {
          const lowerH = header.toLowerCase();
          // 1. Try Default Value
          if (selectedTemplate.default_values[header]) return `"${selectedTemplate.default_values[header]}"`;
          
          // 2. Map known Amazon headers to product data
          const cleaned = listing.cleaned;
          const optimized = listing.optimized;

          if (lowerH.includes('item_name') || lowerH.includes('product_name') || lowerH === 'title') {
             return `"${optimized?.optimized_title || cleaned.title}"`;
          }
          if (lowerH.includes('item_sku') || lowerH.includes('sku')) return `"${listing.asin}"`;
          if (lowerH.includes('external_product_id')) return `"${listing.asin}"`;
          if (lowerH.includes('brand_name')) return `"${cleaned.brand}"`;
          if (lowerH.includes('standard_price')) return `"${cleaned.price}"`;
          if (lowerH.includes('product_description')) return `"${optimized?.optimized_description || cleaned.description}"`;
          if (lowerH.includes('main_image_url')) return `"${cleaned.main_image}"`;
          
          return '""';
        });
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Amazon_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      setExporting(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Download className="text-indigo-600" /> {t('confirmExport')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center gap-6">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                <CheckCircle2 size={24} />
             </div>
             <div>
                <p className="text-sm font-black text-indigo-900">{selectedListings.length} {t('listings')} Selected</p>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Ready for global launch</p>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('selectTemplate')}</label>
             <div className="grid grid-cols-1 gap-3">
                {loading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-200" /></div>
                ) : templates.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                    <p className="text-xs font-bold text-slate-400">No templates found. Create one in Template Manager.</p>
                  </div>
                ) : (
                  templates.map(tmp => (
                    <button 
                      key={tmp.id}
                      onClick={() => setSelectedTemplate(tmp)}
                      className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${
                        selectedTemplate?.id === tmp.id 
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' 
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} />
                      <div className="flex-1">
                        <p className={`font-black text-sm ${selectedTemplate?.id === tmp.id ? 'text-indigo-900' : 'text-slate-700'}`}>{tmp.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{tmp.headers.length} Columns</p>
                      </div>
                      {selectedTemplate?.id === tmp.id && <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white"><Download size={10} /></div>}
                    </button>
                  ))
                )}
             </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
           <button onClick={onClose} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">
             {t('cancel')}
           </button>
           <button 
             disabled={!selectedTemplate || exporting}
             onClick={handleExport}
             className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
           >
             {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
             {exporting ? 'Exporting...' : t('downloadCsv')}
           </button>
        </div>
      </div>
    </div>
  );
};
