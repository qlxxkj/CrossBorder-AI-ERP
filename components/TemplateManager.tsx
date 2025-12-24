
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, X, Check } from 'lucide-react';
import { ExportTemplate, UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface TemplateManagerProps {
  uiLang: UILanguage;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const newTemplate: Partial<ExportTemplate> = {
          name: file.name.replace(/\.[^/.]+$/, ""),
          headers,
          default_values: {},
          marketplace: 'US',
          created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured()) {
          const { data: { session } } = await supabase.auth.getSession();
          const { error } = await supabase.from('templates').insert([{ ...newTemplate, user_id: session?.user?.id }]);
          if (error) alert(error.message);
          else fetchTemplates();
        } else {
          setTemplates(prev => [newTemplate as ExportTemplate, ...prev]);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateDefaultValue = (header: string, value: string) => {
    if (!selectedTemplate) return;
    const updated = {
      ...selectedTemplate,
      default_values: { ...selectedTemplate.default_values, [header]: value }
    };
    setSelectedTemplate(updated);
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('templates')
      .update({ default_values: selectedTemplate.default_values })
      .eq('id', selectedTemplate.id);
    
    if (error) alert(error.message);
    else {
      alert("Template updated!");
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete template?")) return;
    if (isSupabaseConfigured()) {
      await supabase.from('templates').delete().eq('id', id);
      fetchTemplates();
    } else {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Layout size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-medium">{t('manageTemplates')}</p>
          </div>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          <Upload size={18} /> {t('uploadTemplate')}
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)]">
        {/* Template List */}
        <div className="lg:col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {templates.length === 0 ? (
              <div className="p-8 text-center space-y-4">
                 <FileSpreadsheet className="mx-auto text-slate-100" size={48} />
                 <p className="text-slate-400 text-xs font-bold leading-relaxed">{t('noTemplates')}</p>
              </div>
            ) : (
              templates.map(tmp => (
                <button 
                  key={tmp.id}
                  onClick={() => setSelectedTemplate(tmp)}
                  className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all group ${
                    selectedTemplate?.id === tmp.id 
                      ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 shadow-sm' 
                      : 'border-slate-50 bg-white hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} size={20} />
                    <span className="font-bold text-sm truncate">{tmp.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trash2 
                      size={16} 
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => deleteTemplate(tmp.id, e)}
                    />
                    {selectedTemplate?.id === tmp.id && <Check size={16} className="text-indigo-600" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Settings2 className="text-indigo-500" size={18} />
                  <h3 className="font-black text-slate-900 text-sm tracking-tight">{selectedTemplate.name}</h3>
                </div>
                <button 
                  onClick={saveTemplate}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <Save size={14} /> {t('save')}
                </button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-[11px] font-bold text-amber-700 leading-relaxed">
                   Tip: Set default values for columns like "Brand", "Manufacturer", or "Merchant Shipping Group" to save time on every export.
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                     <span>Template Header</span>
                     <span>Default Value</span>
                  </div>
                  {selectedTemplate.headers.map((h, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-50 hover:bg-white hover:border-slate-200 transition-all group">
                      <div className="flex-1">
                         <span className="text-xs font-bold text-slate-700">{h}</span>
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={selectedTemplate.default_values[h] || ''}
                          onChange={(e) => updateDefaultValue(h, e.target.value)}
                          placeholder="Empty (Will use product data if mapped)"
                          className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/20">
               <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-100 border border-slate-100 mb-6">
                  <Settings2 size={40} />
               </div>
               <h4 className="text-slate-900 font-black text-lg mb-2">{t('selectTemplate')}</h4>
               <p className="text-slate-400 text-xs font-medium max-w-xs">{t('noTemplates')}</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};
