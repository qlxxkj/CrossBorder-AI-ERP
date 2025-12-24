
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star, Filter, ArrowRightLeft, Database, Copy } from 'lucide-react';
import { ExportTemplate, UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface TemplateManagerProps {
  uiLang: UILanguage;
}

const AUTO_MAPPED_FIELDS = [
  'item_sku', 'sku', 'seller_sku',
  'external_product_id', 'product_id',
  'external_product_id_type', 'product_id_type',
  'item_name', 'product_name', 'title',
  'brand_name', 'brand',
  'standard_price', 'price', 'list_price',
  'product_description', 'item_description', 'description',
  'main_image_url', 'main_image',
  'other_image_url1', 'other_image_url2', 'other_image_url3',
  'bullet_point1', 'bullet_point2', 'bullet_point3', 'bullet_point4', 'bullet_point5',
  'update_delete', 'feed_product_type', 'item_type'
];

export const TemplateManager: React.FC<TemplateManagerProps> = ({ uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [filterRequired, setFilterRequired] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setDbError(null);
    try {
      const { data, error: dbErr } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
      
      if (dbErr) {
        // 如果报错提示列不存在 (42703 是 PostgreSQL 的 undefined_column 代码)
        if (dbErr.code === '42703' || dbErr.message.includes('required_headers')) {
          setDbError('SCHEMA_INCOMPLETE');
        } else {
          throw dbErr;
        }
      }
      if (data) setTemplates(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copySqlToClipboard = () => {
    const sql = "ALTER TABLE templates ADD COLUMN IF NOT EXISTS required_headers text[];";
    navigator.clipboard.writeText(sql);
    alert(uiLang === 'zh' ? "SQL 已复制！请在 Supabase SQL Editor 中运行。" : "SQL Copied! Run it in Supabase SQL Editor.");
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
        let detectedMarketplace = "US";

        // 1. 解析必填项定义
        const definitionsSheet = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('data definitions') || 
          n.includes('数据定义') ||
          n.includes('Definitions')
        );
        if (definitionsSheet) {
          const sheet = workbook.Sheets[definitionsSheet];
          const defData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          let fieldNameIdx = -1;
          let requiredIdx = -1;
          for (let i = 0; i < Math.min(defData.length, 30); i++) {
            const row = defData[i];
            if (!row) continue;
            const fn = row.findIndex(c => {
              const s = String(c || '').toLowerCase();
              return s.includes('field name') || (s.includes('字段') && s.includes('名称'));
            });
            const req = row.findIndex(c => {
              const s = String(c || '').toLowerCase();
              return s.includes('required') || s.includes('必填');
            });
            if (fn !== -1) fieldNameIdx = fn;
            if (req !== -1) requiredIdx = req;
            if (fieldNameIdx !== -1 && requiredIdx !== -1) break;
          }
          if (fieldNameIdx !== -1 && requiredIdx !== -1) {
            defData.forEach(row => {
              const fieldName = String(row[fieldNameIdx] || '').trim();
              const isReq = String(row[requiredIdx] || '').toLowerCase();
              if (fieldName && (isReq === 'required' || isReq === 'yes' || isReq.includes('必填') || isReq.includes('conditional'))) {
                requiredHeaders.push(fieldName);
              }
            });
          }
        }

        // 2. 解析表头
        const amazonKeywords = ['item_sku', 'sku', 'external_product_id', 'feed_product_type'];
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
            const row = jsonData[i];
            if (!row || !Array.isArray(row)) continue;
            const matchCount = row.filter(c => amazonKeywords.some(k => String(c).toLowerCase().includes(k))).length;
            if (matchCount >= 2) {
              foundHeaders = row.map(h => String(h || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim()).filter(h => h !== '');
              foundSheetName = sheetName;
              break;
            }
          }
          if (foundHeaders.length > 0) break;
        }

        if (foundHeaders.length === 0) throw new Error("No headers found.");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please log in first.");

        const newTemplatePayload: any = {
          user_id: session.user.id,
          name: `${file.name.replace(/\.[^/.]+$/, "")} (${foundSheetName})`,
          headers: foundHeaders,
          required_headers: requiredHeaders,
          default_values: {},
          marketplace: detectedMarketplace,
          created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured()) {
          const { error: insError } = await supabase.from('templates').insert([newTemplatePayload]);
          if (insError) {
            if (insError.code === '42703' || insError.message.includes('required_headers')) {
              setDbError('SCHEMA_INCOMPLETE');
              const { required_headers, ...fallback } = newTemplatePayload;
              await supabase.from('templates').insert([fallback]);
            } else {
              throw insError;
            }
          }
          fetchTemplates();
        }
      } catch (err: any) {
        alert(`Error: ${err.message}`);
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
      alert(uiLang === 'zh' ? "配置已同步" : "Synced!");
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Confirm delete?")) return;
    await supabase.from('templates').delete().eq('id', id);
    fetchTemplates();
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
  };

  const filteredHeaders = useMemo(() => {
    if (!selectedTemplate) return [];
    let headers = selectedTemplate.headers;
    if (filterRequired) {
      headers = headers.filter(h => selectedTemplate.required_headers?.includes(h));
    }
    return headers;
  }, [selectedTemplate, filterRequired]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* 数据库升级警示条 */}
      {dbError === 'SCHEMA_INCOMPLETE' && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-5">
             <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <AlertCircle size={24} />
             </div>
             <div>
                <h4 className="font-black text-amber-900 text-sm uppercase tracking-wider">{uiLang === 'zh' ? '需要升级数据库结构' : 'Database Upgrade Required'}</h4>
                <p className="text-amber-700 text-xs font-medium max-w-xl mt-1">
                  {uiLang === 'zh' 
                    ? "您的数据库缺少 'required_headers' 列。虽然您可以继续使用，但必填项自动识别功能无法生效。请在 Supabase SQL Editor 中运行指令。"
                    : "Your templates table is missing the 'required_headers' column. Please run the SQL command in Supabase to fix this."}
                </p>
             </div>
          </div>
          <div className="flex bg-white rounded-2xl border border-amber-200 p-1 pl-4 items-center">
            <code className="text-[10px] font-mono font-bold text-amber-600 truncate max-w-[200px]">ALTER TABLE templates ADD...</code>
            <button 
              onClick={copySqlToClipboard}
              className="ml-4 px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-600 transition-all active:scale-95"
            >
              <Copy size={12} /> {uiLang === 'zh' ? '复制 SQL' : 'Copy SQL'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Layout size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-bold">Standard Amazon Mapping Engine (Scan Deep for Rows 4-50)</p>
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
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsm, .xlsx, .csv" onChange={handleFileUpload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-320px)]">
        {/* Left List */}
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
                  onClick={() => { setSelectedTemplate(tmp); setFilterRequired(false); }}
                  className={`w-full p-5 rounded-3xl border text-left flex items-center justify-between transition-all group ${
                    selectedTemplate?.id === tmp.id 
                      ? 'border-indigo-500 bg-indigo-50/40 text-indigo-900 shadow-sm ring-1 ring-indigo-500/10' 
                      : 'border-slate-50 bg-white hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} size={24} />
                    <div className="flex flex-col">
                      <span className="font-black text-sm truncate">{tmp.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                        {tmp.required_headers?.length || 0} Required Fields
                      </span>
                    </div>
                  </div>
                  <Trash2 size={18} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => deleteTemplate(tmp.id, e)} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Editor */}
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
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setFilterRequired(!filterRequired)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${
                      filterRequired ? 'bg-amber-500 text-white border-amber-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <Filter size={14} /> {uiLang === 'zh' ? '只看必填' : 'Required Only'}
                  </button>
                  <button onClick={saveTemplate} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-100 active:scale-95 transition-all">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 flex gap-4 items-start">
                      <Star className="text-amber-500 shrink-0 fill-amber-500" size={20} />
                      <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">
                         {uiLang === 'zh' 
                           ? '必填维护：在此设置类目必填项的默认值。系统会自动识别 Data Definitions 中定义的必填字段。' 
                           : 'Mandatory Maintenance: Set default values for category required fields identified from Data Definitions.'}
                      </p>
                   </div>
                   <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex gap-4 items-start">
                      <ArrowRightLeft className="text-blue-500 shrink-0" size={20} />
                      <p className="text-[11px] font-bold text-blue-700 leading-relaxed uppercase tracking-wider">
                         {uiLang === 'zh' 
                           ? '自动映射：标题、价格、主图、ASIN 等常规字段将在导出时自动匹配 Listing 数据，无需在此配置。' 
                           : 'Auto Mapping: Core fields (Title, Price, Images, etc.) will map automatically during export.'}
                      </p>
                   </div>
                </div>

                <div className="space-y-4">
                  {filteredHeaders.map((h, i) => {
                    const isRequired = selectedTemplate.required_headers?.includes(h);
                    const isAutoMapped = AUTO_MAPPED_FIELDS.some(f => h.toLowerCase().includes(f));
                    
                    return (
                      <div key={i} className={`flex flex-col sm:flex-row gap-4 p-5 rounded-3xl border transition-all group ${
                        isRequired ? 'bg-red-50/20 border-red-100 shadow-[inset_0_1px_4px_rgba(220,38,38,0.05)]' : 
                        isAutoMapped ? 'bg-slate-50/50 border-slate-50 opacity-60' : 'bg-slate-50/30 border-slate-50 hover:bg-white hover:shadow-sm'
                      }`}>
                        <div className="sm:w-1/3 flex items-center gap-2">
                          <span className={`text-[11px] font-black break-all leading-tight ${isRequired ? 'text-red-700' : isAutoMapped ? 'text-slate-400' : 'text-slate-600'}`}>
                            {h}
                          </span>
                          {isRequired && <Star size={10} className="text-red-500 fill-red-500 shrink-0" />}
                          {isAutoMapped && (
                            <span title="Auto-mapped field">
                              <Database size={10} className="text-slate-300 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          {isAutoMapped ? (
                            <div className="px-5 py-3 bg-slate-100/50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                               <Check size={12} /> Auto-Mapped from Listing
                            </div>
                          ) : (
                            <input 
                              type="text" 
                              value={selectedTemplate.default_values[h] || ''}
                              onChange={(e) => updateDefaultValue(h, e.target.value)}
                              placeholder={isRequired ? "Mandatory: Enter default value..." : "Optional value..."}
                              className={`w-full px-5 py-3 bg-white border rounded-2xl text-sm font-bold focus:ring-4 outline-none transition-all shadow-sm ${
                                isRequired ? 'border-red-200 focus:ring-red-500/10 focus:border-red-500 text-red-900 placeholder:text-red-200' : 'border-slate-100 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-900'
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/20">
               <div className="w-24 h-24 bg-white rounded-[2rem] border border-slate-100 shadow-xl flex items-center justify-center text-slate-100 mb-8 transform rotate-12 transition-transform hover:rotate-0">
                  <Settings2 size={48} />
               </div>
               <h4 className="text-slate-900 font-black text-2xl mb-3 tracking-tight">{t('selectTemplate')}</h4>
               <p className="text-slate-400 text-sm font-bold max-w-xs leading-relaxed">
                  {uiLang === 'zh' ? '请从左侧列表选择一个模板，或上传新的亚马逊官方刊登文件。' : 'Select a template from the list on the left or upload a new Amazon batch file.'}
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
