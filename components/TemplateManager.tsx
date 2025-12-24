
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check } from 'lucide-react';
import { ExportTemplate, UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface TemplateManagerProps {
  uiLang: UILanguage;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
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

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Amazon templates usually have 3 rows of headers. We'll use the "Internal Name" row (often row 3)
        // Or we just take the first row that looks like headers.
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Strategy: find a row with many columns to be the header row
        // For Amazon, row 3 (index 2) is usually the "Feed Product Type" or "SKU" identifier row.
        const headerRowIndex = jsonData.findIndex(row => row.includes('sku') || row.includes('item_sku') || row.length > 10);
        const headers = (jsonData[headerRowIndex > -1 ? headerRowIndex : 0] || [])
          .map(h => String(h || '').trim())
          .filter(h => h !== '');

        if (headers.length === 0) throw new Error("Could not find valid headers in file.");

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
          if (error) throw error;
          fetchTemplates();
        } else {
          setTemplates(prev => [newTemplate as ExportTemplate, ...prev]);
        }
      } catch (err: any) {
        alert("Template processing failed: " + err.message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateDefaultValue = (header: string, value: string) => {
    if (!selectedTemplate) return;
    setSelectedTemplate({
      ...selectedTemplate,
      default_values: { ...selectedTemplate.default_values, [header]: value }
    });
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('templates')
      .update({ default_values: selectedTemplate.default_values })
      .eq('id', selectedTemplate.id);
    
    if (error) alert(error.message);
    else {
      alert("Template default values saved!");
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
            <p className="text-sm text-slate-400 font-medium">Manage Amazon XLSM/CSV templates</p>
          </div>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
        >
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {t('uploadTemplate')}
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsm,.xlsx,.csv" onChange={handleFileUpload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)]">
        <div className="lg:col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {templates.length === 0 ? (
              <div className="p-8 text-center space-y-4">
                 <FileSpreadsheet className="mx-auto text-slate-100" size={48} />
                 <p className="text-slate-400 text-xs font-bold">{t('noTemplates')}</p>
              </div>
            ) : (
              templates.map(tmp => (
                <button 
                  key={tmp.id}
                  onClick={() => setSelectedTemplate(tmp)}
                  className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all group ${
                    selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-50 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} size={20} />
                    <span className="font-bold text-sm truncate">{tmp.name}</span>
                  </div>
                  <Trash2 size={16} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => deleteTemplate(tmp.id, e)} />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-sm">{selectedTemplate.name}</h3>
                <button onClick={saveTemplate} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Save size={14} /> {t('save')}
                </button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  {selectedTemplate.headers.map((h, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-50 hover:bg-white transition-all">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-700">{h}</span>
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={selectedTemplate.default_values[h] || ''}
                          onChange={(e) => updateDefaultValue(h, e.target.value)}
                          placeholder="Default value..."
                          className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-slate-400">
               <Settings2 size={40} className="mb-4 opacity-20" />
               <h4 className="font-black">{t('selectTemplate')}</h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
