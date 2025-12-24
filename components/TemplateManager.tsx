
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react';
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
        setError(uiLang === 'zh' ? "数据库中缺少 'templates' 表，请运行 SQL 脚本创建。" : "Table 'templates' not found. Please run the SQL script in your Supabase dashboard.");
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
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 解析所有行
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 亚马逊模板通常在前几行包含说明。
        // 策略：寻找第一行包含超过 5 个非空单元格的行作为表头。
        let headerRowIndex = jsonData.findIndex(row => row && Array.isArray(row) && row.filter(c => c !== null && c !== '').length > 5);
        
        // 特殊处理亚马逊官方模板：有时第3行才是真正的内部字段名
        const potentialAmazonHeaderIdx = jsonData.findIndex(row => row && row.includes('item_sku') || row.includes('sku') || row.includes('item_name'));
        if (potentialAmazonHeaderIdx !== -1) headerRowIndex = potentialAmazonHeaderIdx;

        const headers = (jsonData[headerRowIndex > -1 ? headerRowIndex : 0] || [])
          .map(h => String(h || '').trim())
          .filter(h => h !== '');

        if (headers.length === 0) throw new Error(uiLang === 'zh' ? "未能从文件中提取到有效的表头字段。" : "Could not find valid headers in file.");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please log in first.");

        const newTemplatePayload = {
          user_id: session.user.id,
          name: file.name.replace(/\.[^/.]+$/, ""),
          headers,
          default_values: {},
          marketplace: 'US',
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
        alert("Template upload failed: " + err.message);
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
      alert(uiLang === 'zh' ? "模板默认值已保存" : "Template saved successfully!");
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(uiLang === 'zh' ? "确定要删除此模板吗？" : "Delete template?")) return;
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
            <p className="text-sm text-slate-400 font-medium">Manage Amazon Official XLSM Templates</p>
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

      {error && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-start gap-4">
           <AlertCircle className="text-red-600 shrink-0" />
           <div>
              <p className="text-red-900 font-black text-sm">{uiLang === 'zh' ? '功能配置未完成' : 'Configuration Required'}</p>
              <p className="text-red-600 text-xs font-medium mt-1 leading-relaxed">{error}</p>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)]">
        <div className="lg:col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {loading ? (
               <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-200" /></div>
            ) : templates.length === 0 ? (
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
                <div className="flex items-center gap-3">
                  <Settings2 className="text-indigo-500" size={18} />
                  <h3 className="font-black text-slate-900 text-sm tracking-tight">{selectedTemplate.name}</h3>
                </div>
                <button onClick={saveTemplate} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 transition-all">
                  <Save size={14} /> {t('save')}
                </button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-[11px] font-bold text-amber-700 leading-relaxed mb-6">
                   {uiLang === 'zh' ? '提示：为“品牌”、“分类”或“配送方案”等固定字段设置默认值，可极大减少导出后的手动修改工作。' : 'Tip: Setting default values for fixed columns like "Brand" or "Fulfillment" can save significant manual editing time.'}
                </div>
                <div className="space-y-4">
                  {selectedTemplate.headers.map((h, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-50 hover:bg-white hover:border-slate-200 transition-all">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-700">{h}</span>
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={selectedTemplate.default_values[h] || ''}
                          onChange={(e) => updateDefaultValue(h, e.target.value)}
                          placeholder="Default value..."
                          className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/20">
               <Settings2 size={40} className="mb-4 opacity-20 text-slate-400" />
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
