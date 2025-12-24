
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
        setError(uiLang === 'zh' ? "数据库中缺少 'templates' 表，请运行之前提供的 SQL 脚本创建。" : "Table 'templates' not found. Please run the SQL script in your Supabase dashboard.");
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
        
        // 1. 智能寻找目标工作表 (优先找 Template, 其次找包含数据的)
        let targetSheetName = workbook.SheetNames[0];
        const prioritySheet = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('template') || 
          n.includes('模板') || 
          n.includes('刊登')
        );
        if (prioritySheet) targetSheetName = prioritySheet;
        
        const worksheet = workbook.Sheets[targetSheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (jsonData.length === 0) throw new Error("Working sheet is empty.");

        // 2. 寻找表头行
        // 策略 A: 查找包含关键字段的行
        let headerRowIndex = jsonData.findIndex(row => 
          row && Array.isArray(row) && 
          row.some(c => {
            const s = String(c).toLowerCase();
            return s.includes('item_sku') || s.includes('sku') || s.includes('external_product_id');
          })
        );

        // 策略 B: 如果没找到关键字段，找列数最多的那一行（通常是表头）
        if (headerRowIndex === -1) {
          let maxCols = 0;
          jsonData.forEach((row, idx) => {
            const count = row.filter(c => String(c).trim() !== '').length;
            if (count > maxCols) {
              maxCols = count;
              headerRowIndex = idx;
            }
          });
        }

        const targetRow = headerRowIndex > -1 ? jsonData[headerRowIndex] : null;
        
        if (!targetRow || targetRow.length < 3) {
          throw new Error(uiLang === 'zh' ? "未能识别有效的表头，请确认该 Excel 文件是包含字段定义的亚马逊刊登模板。" : "Invalid template format. Header row not found.");
        }

        const headers = targetRow
          .map(h => String(h || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim())
          .filter(h => h !== '');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please log in first.");

        const newTemplatePayload = {
          user_id: session.user.id,
          name: `${file.name.replace(/\.[^/.]+$/, "")} (${targetSheetName})`,
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
        console.error("Upload error:", err);
        alert(uiLang === 'zh' ? `模板处理失败: ${err.message}` : `Template processing failed: ${err.message}`);
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
      alert(uiLang === 'zh' ? "模板配置已更新" : "Template settings updated!");
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
            <p className="text-sm text-slate-400 font-medium">支持亚马逊官方 .xlsm (多工作表) 及 CSV 格式</p>
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
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".xlsm, .xlsx, .csv" 
          onChange={handleFileUpload} 
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex items-start gap-4">
           <AlertCircle className="text-red-600 shrink-0" />
           <div>
              <p className="text-red-900 font-black text-sm">{uiLang === 'zh' ? '数据库未就绪' : 'Database Not Ready'}</p>
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
                 <p className="text-slate-400 text-xs font-bold">{t('noTemplates')}</p>
              </div>
            ) : (
              templates.map(tmp => (
                <button 
                  key={tmp.id}
                  onClick={() => setSelectedTemplate(tmp)}
                  className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all group ${
                    selectedTemplate?.id === tmp.id 
                      ? 'border-indigo-50/50 bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-500/20' 
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
                   {uiLang === 'zh' ? '在此设置固定值（如品牌名、配送方式、类目名），这些值将在批量导出 CSV 时自动填充到对应列。' : 'Set fixed values here (e.g. Brand, Fulfillment, Category). They will be auto-filled in the exported CSV.'}
                </div>
                <div className="space-y-4">
                  {selectedTemplate.headers.map((h, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-50 hover:bg-white transition-all group">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-700 break-all">{h}</span>
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={selectedTemplate.default_values[h] || ''}
                          onChange={(e) => updateDefaultValue(h, e.target.value)}
                          placeholder="设置默认值..."
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
               <p className="text-slate-400 text-xs font-medium max-w-xs">从左侧选择已上传的模板，或上传新的亚马逊 XLSM 文件。</p>
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
