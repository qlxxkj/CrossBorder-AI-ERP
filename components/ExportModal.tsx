
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

  const cleanString = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/"/g, '""');
  };

  const handleExport = () => {
    if (!selectedTemplate) return;
    setExporting(true);

    try {
      // Amazon Flat File Structure: 
      // Row 1: Instruction
      // Row 2: Service Version
      // Row 3: Marketplace
      // Row 4: Header (the one we stored)
      // Row 5-7: Labels/Instructions
      // Row 8+: Data
      
      const csvRows = [];
      
      // Placeholder metadata rows for rows 1-3
      csvRows.push(""); 
      csvRows.push("version=2023.1210"); 
      csvRows.push(`Marketplace=${selectedTemplate.marketplace || 'US'}`);
      
      // Row 4: Headers
      csvRows.push(selectedTemplate.headers.join(','));
      
      // Row 5-7: Sub-headers / metadata
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));
      csvRows.push(selectedTemplate.headers.map(() => "").join(','));

      selectedListings.forEach(listing => {
        const cleaned = listing.cleaned;
        const optimized = listing.optimized;

        const row = selectedTemplate.headers.map(header => {
          const lowerH = header.toLowerCase();
          
          if (selectedTemplate.default_values[header]) {
            return `"${cleanString(selectedTemplate.default_values[header])}"`;
          }

          let value = '';
          
          // Improved mapping for Amazon standard headers
          if (lowerH.includes('item_name') || lowerH.includes('product_name') || lowerH === 'title' || lowerH === 'product_title') {
             value = optimized?.optimized_title || cleaned.title;
          } else if (lowerH.includes('item_sku') || lowerH.includes('sku') || lowerH.includes('seller_sku')) {
             value = listing.asin;
          } else if (lowerH.includes('external_product_id') || lowerH.includes('product_id')) {
             value = listing.asin;
          } else if (lowerH.includes('external_product_id_type')) {
             value = 'ASIN';
          } else if (lowerH.includes('brand_name') || lowerH === 'brand') {
             value = cleaned.brand;
          } else if (lowerH.includes('standard_price') || lowerH === 'price' || lowerH.includes('list_price')) {
             value = String(cleaned.price);
          } else if (lowerH.includes('product_description') || lowerH.includes('item_description') || lowerH === 'description') {
             value = optimized?.optimized_description || cleaned.description;
          } else if (lowerH.includes('main_image_url') || lowerH === 'main_image') {
             value = cleaned.main_image;
          } else if (lowerH.includes('other_image_url1')) {
             value = cleaned.other_images?.[0] || '';
          } else if (lowerH.includes('bullet_point')) {
             const points = optimized?.optimized_features || cleaned.features || [];
             const idxMatch = lowerH.match(/bullet_point(\d+)/);
             if (idxMatch) {
               const idx = parseInt(idxMatch[1]) - 1;
               value = points[idx] || '';
             }
          } else if (lowerH.includes('update_delete')) {
             value = 'Update';
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
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Format: Row 4 Headers, Row 8 Data</p>
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
                    <div className="flex flex-col">
                      <span className="font-black text-sm truncate">{tmp.name}</span>
                      {tmp.required_headers && (
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{tmp.required_headers.length} Mandatory Fields</span>
                      )}
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
