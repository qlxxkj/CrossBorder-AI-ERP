
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data, error: dbError } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
      if (dbError) throw dbError;
      if (data) setTemplates(data);
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('public.templates')) {
        setError(uiLang === 'zh' ? "数据库中缺少 'templates' 表，请在 Supabase 控制台运行 SQL 脚本。" : "Table 'templates' not found. Please run the SQL script in Supabase.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
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
        
        let foundHeaders: string[] = [];
        let requiredHeaders: string[] = [];
        let foundSheetName = "";

        // 1. Parse "Data Definitions" sheet to find mandatory fields
        const definitionsSheet = workbook.SheetNames.find(n => n.includes('Data Definitions') || n.includes('数据定义'));
        if (definitionsSheet) {
          const sheet = workbook.Sheets[definitionsSheet];
          const defData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          // Find "Field Name" and "Required" column indices
          let fieldNameIdx = -1;
          let requiredIdx = -1;
          
          for (let i = 0; i < Math.min(defData.length, 10); i++) {
            const row = defData[i];
            if (!row) continue;
            const fn = row.findIndex(c => String(c || '').toLowerCase().includes('field name'));
            const req = row.findIndex(c => String(c || '').toLowerCase().includes('required'));
            if (fn !== -1) fieldNameIdx = fn;
            if (req !== -1) requiredIdx = req;
            if (fieldNameIdx !== -1 && requiredIdx !== -1) break;
          }

          if (fieldNameIdx !== -1 && requiredIdx !== -1) {
            defData.forEach(row => {
              const fieldName = String(row[fieldNameIdx] || '').trim();
              const isReq = String(row[requiredIdx] || '').toLowerCase();
              if (fieldName && (isReq === 'required' || isReq === 'yes' || isReq.includes('必填'))) {
                requiredHeaders.push(fieldName);
              }
            });
          }
        }

        // 2. Parse "Template" sheet for actual headers (Row 4)
        const templateSheetName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('template') || 
          n.includes('模板') || 
          n.includes('刊登')
        ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[templateSheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Amazon Standard: Row 1-3 are instructions/labels, Row 4 is Header, Data starts Row 8
        const headerRowIndex = 3; // Index 3 is Row 4
        const headerRow = jsonData[headerRowIndex];

        if (headerRow && headerRow.length > 5) {
          foundHeaders = headerRow.map(h => String(h || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim()).filter(h => h !== '');
          foundSheetName = templateSheetName;
        } else {
          // Fallback to keyword search if Row 4 is not standard
          const keywords = ['item_sku', 'external_product_id', 'item_name'];
          for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
            const row = jsonData[i];
            if (row && row.some(c => keywords.some(k => String(c).toLowerCase().includes(k)))) {
              foundHeaders = row.map(h => String(h || '').trim()).filter(h => h !== '');
              foundSheetName = templateSheetName;
              break;
            }
          }
        }

        if (foundHeaders.length === 0) {
          throw new Error(uiLang === 'zh' ? "在工作簿中未找到有效的亚马逊表头（通常在第4行）。" : "No valid Amazon headers found (usually row 4).");
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please log in first.");

        const newTemplatePayload = {
          user_id: session.user.id,
          name: `${file.name.replace(/\.[^/.]+$/, "")} (${foundSheetName})`,
          headers: foundHeaders,
          required_headers: requiredHeaders,
          default_values: {},
          marketplace: 'US', // Can be refined by parsing Template sheet if info exists
          created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured()) {
          const { error: insError } = await supabase.from('templates').insert([newTemplatePayload]);
          if (insError) throw insError;
          fetchTemplates();
        } else {
          setTemplates(prev => [newTemplatePayload as any as ExportTemplate, ...prev]);
        }
      } catch (err: any) {
        console.error("Template parse error:", err);
        alert(uiLang === 'zh' ? `解析失败: ${err.message}` : `Parse error: ${err.message}`);
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
    const { error: updError } = await supabase
      .from('templates')
      .update({ default_values: selectedTemplate.default_values })
      .eq('id', selectedTemplate.id);
    
    if (updError) alert(updError.message);
    else {
      alert(uiLang === 'zh' ? "配置已保存" : "Configuration saved!");
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(uiLang === 'zh' ? "删除模板？" : "Delete template?")) return;
    if (isSupabaseConfigured()) {
      await supabase.from('templates').delete().eq('id', id);
      fetchTemplates();
    } else {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Layout size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-bold">Standard Amazon Header (Row 4) & Data Definitions Support</p>
          </div>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
        >
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {t('uploadTemplate')}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".xlsm, .xlsx, .csv" 
          onChange={handleFileUpload} 
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
           <AlertCircle className="text-red-600 shrink-0" size={24} />
           <div>
              <p className="text-red-900 font-black text-sm">{uiLang === 'zh' ? '数据库配置错误' : 'Database Error'}</p>
              <p className="text-red-600 text-xs font-bold mt-1 leading-relaxed">{error}</p>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-320px)]">
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
            {loading ? (
               <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" /></div>
            ) : templates.length === 0 ? (
              <div className="p-10 text-center space-y-5 opacity-40">
                 <FileSpreadsheet className="mx-auto text-slate-300" size={64} />
                 <p className="text-slate-500 text-sm font-black leading-relaxed">{t('noTemplates')}</p>
              </div>
            ) : (
              templates.map(tmp => (
                <button 
                  key={tmp.id}
                  onClick={() => setSelectedTemplate(tmp)}
                  className={`w-full p-5 rounded-3xl border text-left flex items-center justify-between transition-all group ${
                    selectedTemplate?.id === tmp.id 
                      ? 'border-indigo-500 bg-indigo-50/40 text-indigo-900 shadow-sm' 
                      : 'border-slate-50 bg-white hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} size={24} />
                    <span className="font-black text-sm truncate">{tmp.name}</span>
                  </div>
                  <Trash2 size={18} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => deleteTemplate(tmp.id, e)} />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <Settings2 size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 text-base tracking-tight truncate max-w-md">{selectedTemplate.name}</h3>
                </div>
                <button onClick={saveTemplate} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-100 active:scale-95 transition-all">
                  <Save size={16} /> {t('save')}
                </button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 flex gap-4 items-start">
                   <Info className="text-amber-500 shrink-0" size={20} />
                   <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">
                      {uiLang === 'zh' 
                        ? '红色星号标记的字段为亚马逊必填字段（由 Data Definitions 识别），请优先维护以确保成功刊登。' 
                        : 'Fields with red stars are mandatory (from Data Definitions). Maintain these first to ensure successful listing.'}
                   </p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {selectedTemplate.headers.map((h, i) => {
                    const isRequired = selectedTemplate.required_headers?.includes(h);
                    return (
                      <div key={i} className={`flex flex-col sm:flex-row gap-4 p-5 rounded-3xl border transition-all group ${isRequired ? 'bg-red-50/20 border-red-100' : 'bg-slate-50/50 border-slate-50 hover:bg-white'}`}>
                        <div className="sm:w-1/3 flex items-center gap-2">
                          <span className={`text-xs font-black break-all leading-tight ${isRequired ? 'text-red-600' : 'text-slate-500'}`}>
                            {h}
                          </span>
                          {isRequired && <Star size={10} className="text-red-500 fill-red-500 shrink-0" />}
                        </div>
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={selectedTemplate.default_values[h] || ''}
                            onChange={(e) => updateDefaultValue(h, e.target.value)}
                            placeholder={isRequired ? "Mandatory field..." : "Optional value..."}
                            className={`w-full px-5 py-3 bg-white border rounded-2xl text-sm font-bold focus:ring-4 outline-none transition-all shadow-sm ${isRequired ? 'border-red-200 focus:ring-red-500/10 focus:border-red-500 text-red-900 placeholder:text-red-300' : 'border-slate-100 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-900'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/20">
               <div className="w-24 h-24 bg-white rounded-[2rem] border border-slate-100 shadow-xl flex items-center justify-center text-slate-100 mb-8 transform rotate-6 transition-transform hover:rotate-0">
                  <Settings2 size={48} />
               </div>
               <h4 className="text-slate-900 font-black text-2xl mb-3 tracking-tight">{t('selectTemplate')}</h4>
               <p className="text-slate-400 text-sm font-bold max-w-xs leading-relaxed">
                  {uiLang === 'zh' ? '请从左侧列表选择一个模板。' : 'Select a template from the list on the left.'}
               </p>
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
