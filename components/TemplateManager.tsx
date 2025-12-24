
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star, Filter, ArrowRightLeft, Database, Copy, Shuffle, ChevronDown } from 'lucide-react';
import { ExportTemplate, UILanguage, FieldMapping } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface TemplateManagerProps {
  uiLang: UILanguage;
}

const LISTING_SOURCE_FIELDS = [
  { value: 'asin', label: 'ASIN / SKU' },
  { value: 'title', label: 'Optimized Title' },
  { value: 'price', label: 'Standard Price' },
  { value: 'brand', label: 'Brand Name' },
  { value: 'description', label: 'Optimized Description' },
  { value: 'feature1', label: 'Bullet Point 1' },
  { value: 'feature2', label: 'Bullet Point 2' },
  { value: 'feature3', label: 'Bullet Point 3' },
  { value: 'feature4', label: 'Bullet Point 4' },
  { value: 'feature5', label: 'Bullet Point 5' },
  { value: 'main_image', label: 'Main Image URL' },
  { value: 'other_image1', label: 'Other Image 1' },
  { value: 'weight', label: 'Item Weight' },
  { value: 'dimensions', label: 'Dimensions' },
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
        if (dbErr.code === '42703' || dbErr.message.includes('required_headers') || dbErr.message.includes('mappings')) {
          setDbError('SCHEMA_INCOMPLETE');
        } else {
          console.error("Fetch error:", dbErr);
        }
      }
      if (data) setTemplates(data);
    } catch (err: any) {
      console.error(err);
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
        
        console.log("Workbook Sheets:", workbook.SheetNames);

        let foundHeaders: string[] = [];
        let requiredHeaders: string[] = [];
        let fieldDefinitions: Record<string, { dataType?: string; acceptedValues?: string[] }> = {};
        let foundSheetName = "";

        // 1. 优先解析 Data Definitions (数据定义) 获取必填项和类型
        const definitionsSheet = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('data definitions') || n.includes('数据定义')
        );
        if (definitionsSheet) {
          const sheet = workbook.Sheets[definitionsSheet];
          const defData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          let colMap: Record<string, number> = {};
          
          for (let i = 0; i < Math.min(defData.length, 50); i++) {
            const row = defData[i];
            if (!row) continue;
            row.forEach((cell, idx) => {
              const s = String(cell || '').toLowerCase();
              if (s.includes('field name') || (s.includes('字段') && s.includes('名称'))) colMap.fieldName = idx;
              if (s.includes('required') || s.includes('必填')) colMap.required = idx;
              if (s.includes('accepted values') || s.includes('可选值')) colMap.accepted = idx;
              if (s.includes('data type') || s.includes('数据类型')) colMap.type = idx;
            });
            if (colMap.fieldName !== undefined) break;
          }

          if (colMap.fieldName !== undefined) {
            defData.forEach(row => {
              const fieldName = String(row[colMap.fieldName] || '').trim();
              if (!fieldName) return;
              const isReq = String(row[colMap.required] || '').toLowerCase();
              if (isReq === 'required' || isReq === 'yes' || isReq.includes('必填') || isReq.includes('conditional')) {
                requiredHeaders.push(fieldName);
              }
              fieldDefinitions[fieldName] = {
                dataType: row[colMap.type],
                acceptedValues: row[colMap.accepted] ? String(row[colMap.accepted]).split(',').map(v => v.trim()).filter(v => v !== '') : undefined
              };
            });
          }
        }

        // 2. 解析 Template Sheet (以名为 Template 的 Sheet 为主)
        const amazonKeywords = ['item_sku', 'sku', 'external_product_id', 'feed_product_type', 'item_name'];
        const templateSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'template' || n.includes('模板'));
        
        if (templateSheetName) {
          const worksheet = workbook.Sheets[templateSheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          // 核心逻辑：通常在第 4 行 (Index 3)
          const row4 = jsonData[3];
          if (row4 && row4.some(c => amazonKeywords.some(k => String(c).toLowerCase().includes(k)))) {
            foundHeaders = row4.map(h => String(h || '').trim()).filter(h => h !== '');
            foundSheetName = templateSheetName;
          } else {
            // 兜底扫描前 50 行
            for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
              const row = jsonData[i];
              if (row && row.filter(c => amazonKeywords.some(k => String(c).toLowerCase().includes(k))).length >= 2) {
                foundHeaders = row.map(h => String(h || '').trim()).filter(h => h !== '');
                foundSheetName = templateSheetName;
                break;
              }
            }
          }
        }

        if (foundHeaders.length === 0) {
          throw new Error(uiLang === 'zh' ? "无法定位模板表头。请确保文件包含名为 'Template' 的工作表且第4行为有效字段。" : "Could not locate headers. Ensure 'Template' sheet exists with fields on Row 4.");
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Auth session missing.");

        // 初始化映射逻辑
        const initialMappings: Record<string, FieldMapping> = {};
        foundHeaders.forEach(h => {
          const lowerH = h.toLowerCase();
          let source: 'listing' | 'custom' = 'custom';
          let field = '';

          if (lowerH.includes('sku') || lowerH.includes('external_product_id')) { source = 'listing'; field = 'asin'; }
          else if (lowerH.includes('item_name') || lowerH === 'title' || lowerH === 'item_title') { source = 'listing'; field = 'title'; }
          else if (lowerH.includes('price')) { source = 'listing'; field = 'price'; }
          else if (lowerH.includes('description')) { source = 'listing'; field = 'description'; }
          else if (lowerH.includes('main_image')) { source = 'listing'; field = 'main_image'; }
          else if (lowerH.includes('bullet_point')) {
            const m = lowerH.match(/bullet_point(\d+)/);
            if (m) { source = 'listing'; field = `feature${m[1]}`; }
          }

          initialMappings[h] = {
            header: h,
            source,
            listingField: field,
            dataType: fieldDefinitions[h]?.dataType,
            acceptedValues: fieldDefinitions[h]?.acceptedValues
          };
        });

        const payload: any = {
          user_id: session.user.id,
          name: `${file.name.replace(/\.[^/.]+$/, "")} (${foundSheetName})`,
          headers: foundHeaders,
          required_headers: requiredHeaders,
          mappings: initialMappings,
          default_values: {},
          marketplace: "US",
          created_at: new Date().toISOString()
        };

        // 插入数据库逻辑 (带降级重试)
        if (isSupabaseConfigured()) {
          const tryInsert = async (data: any): Promise<void> => {
            const { error: insErr } = await supabase.from('templates').insert([data]);
            if (insErr) {
              // 针对字段缺失的递归降级
              if (insErr.code === '42703') {
                setDbError('SCHEMA_INCOMPLETE');
                if (data.mappings && data.required_headers) {
                  const { mappings, ...rest } = data;
                  return tryInsert(rest);
                } else if (data.required_headers) {
                  const { required_headers, ...rest } = data;
                  return tryInsert(rest);
                }
              }
              throw insErr;
            }
          };

          await tryInsert(payload);
          fetchTemplates();
          alert(uiLang === 'zh' ? "模板上传成功！" : "Template uploaded successfully!");
        }

      } catch (err: any) {
        console.error("Upload Error:", err);
        alert(`${uiLang === 'zh' ? '上传失败' : 'Upload Failed'}: ${err.message}`);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateMapping = (header: string, updates: Partial<FieldMapping>) => {
    if (!selectedTemplate) return;
    const newMappings = { ...selectedTemplate.mappings };
    newMappings[header] = { ...newMappings[header], ...updates };
    setSelectedTemplate({ ...selectedTemplate, mappings: newMappings });
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !isSupabaseConfigured()) return;
    try {
      const { error } = await supabase
        .from('templates')
        .update({ mappings: selectedTemplate.mappings, default_values: selectedTemplate.default_values })
        .eq('id', selectedTemplate.id);
      
      if (error) throw error;
      alert(uiLang === 'zh' ? "保存成功" : "Saved!");
      fetchTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(uiLang === 'zh' ? "确认删除该模板？" : "Delete?")) return;
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
      {/* 数据库升级提醒 */}
      {dbError === 'SCHEMA_INCOMPLETE' && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-5">
             <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <AlertCircle size={24} />
             </div>
             <div>
                <h4 className="font-black text-amber-900 text-sm uppercase">{uiLang === 'zh' ? '数据库结构不完整' : 'DB Schema Outdated'}</h4>
                <p className="text-amber-700 text-xs font-medium mt-1">
                  {uiLang === 'zh' 
                    ? "由于缺少所需的表字段（mappings/required_headers），部分高级功能已禁用。请在 Supabase SQL Editor 中运行升级指令。"
                    : "Some features are disabled due to missing DB columns. Please upgrade your schema."}
                </p>
             </div>
          </div>
          <button 
            onClick={() => {
              const sql = "ALTER TABLE templates ADD COLUMN IF NOT EXISTS required_headers text[], ADD COLUMN IF NOT EXISTS mappings jsonb DEFAULT '{}';";
              navigator.clipboard.writeText(sql);
              alert("SQL Copied!");
            }}
            className="px-6 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-600 transition-all active:scale-95 shadow-md"
          >
            <Copy size={12} /> {uiLang === 'zh' ? '复制修复 SQL' : 'Copy Fix SQL'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Layout size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-bold">Amazon Mapping Engine &bull; Locked Row 4 Mapping</p>
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
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsm, .xlsx" onChange={handleFileUpload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-320px)]">
        {/* Template List */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
            {loading ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div> : 
              templates.length === 0 ? (
                <div className="p-10 text-center opacity-40">
                  <FileSpreadsheet className="mx-auto mb-4" size={48} />
                  <p className="text-sm font-bold">{t('noTemplates')}</p>
                </div>
              ) : (
                templates.map(tmp => (
                  <button 
                    key={tmp.id} 
                    onClick={() => setSelectedTemplate(tmp)} 
                    className={`w-full p-5 rounded-3xl border text-left flex items-center justify-between transition-all group ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/10' : 'border-slate-50 bg-white hover:border-slate-200'}`}
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} size={24} />
                      <div className="flex flex-col">
                        <span className="font-black text-sm truncate">{tmp.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{tmp.headers?.length || 0} Columns</span>
                      </div>
                    </div>
                    <Trash2 
                      size={18} 
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" 
                      onClick={(e) => deleteTemplate(tmp.id, e)} 
                    />
                  </button>
                ))
              )
            }
          </div>
        </div>

        {/* Mapping Editor */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="font-black text-slate-900 truncate max-w-md">{selectedTemplate.name}</h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Amazon Batch Template</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFilterRequired(!filterRequired)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border transition-all ${filterRequired ? 'bg-amber-500 text-white border-amber-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}>
                    <Filter size={14} /> {uiLang === 'zh' ? '必填筛选' : 'Required'}
                  </button>
                  <button onClick={saveTemplate} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex gap-4">
                    <ArrowRightLeft className="text-blue-500 shrink-0" size={20} />
                    <p className="text-[11px] font-bold text-blue-700 uppercase leading-relaxed">
                      {uiLang === 'zh' ? '字段映射：映射 Listing 采集的数据，导出时将自动填入。' : 'Auto Mapping: Mapped listing data will be auto-filled during export.'}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-5 rounded-3xl border border-purple-100 flex gap-4">
                    <Shuffle className="text-purple-500 shrink-0" size={20} />
                    <p className="text-[11px] font-bold text-purple-700 uppercase leading-relaxed">
                      {uiLang === 'zh' ? '智能填充：勾选后，若原始数据缺失，将根据 Data Definitions 随机生成。' : 'Smart Fill: Generates random values if source data is missing.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredHeaders.map((h, i) => {
                    const isRequired = selectedTemplate.required_headers?.includes(h);
                    const mapping = selectedTemplate.mappings?.[h] || { header: h, source: 'custom' };
                    
                    return (
                      <div key={i} className={`p-5 rounded-3xl border transition-all hover:bg-white group ${isRequired ? 'bg-red-50/20 border-red-100 shadow-[inset_0_1px_4px_rgba(220,38,38,0.05)]' : 'bg-slate-50/30 border-slate-100 hover:shadow-sm'}`}>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                          <div className="sm:w-1/4 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-black break-all leading-tight ${isRequired ? 'text-red-700' : 'text-slate-600'}`}>{h}</span>
                              {isRequired && <Star size={10} className="text-red-500 fill-red-500 shadow-sm" />}
                            </div>
                            {mapping.dataType && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{mapping.dataType}</span>}
                          </div>

                          <div className="sm:w-1/3">
                            <select 
                              value={mapping.source === 'listing' ? mapping.listingField : mapping.source === 'random' ? 'random' : 'custom'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') updateMapping(h, { source: 'custom', listingField: '' });
                                else if (val === 'random') updateMapping(h, { source: 'random', listingField: '' });
                                else updateMapping(h, { source: 'listing', listingField: val });
                              }}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
                            >
                              <option value="custom">Manual / Static Value</option>
                              <option value="random">🎲 Random (Auto-generate)</option>
                              <optgroup label="Listing Sources">
                                {LISTING_SOURCE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </optgroup>
                            </select>
                          </div>

                          <div className="flex-1 flex items-center gap-3">
                            {mapping.source === 'custom' ? (
                              <input 
                                type="text"
                                value={mapping.defaultValue || ''}
                                onChange={(e) => updateMapping(h, { defaultValue: e.target.value })}
                                placeholder={uiLang === 'zh' ? "输入静态值..." : "Enter static value..."}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                              />
                            ) : (
                              <div className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 border ${mapping.source === 'random' ? 'bg-purple-50 border-purple-100 text-purple-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                                {mapping.source === 'random' ? <Shuffle size={14} /> : <Database size={14} />}
                                {mapping.source === 'random' ? 'Random Generation Mode' : `Mapped to ${LISTING_SOURCE_FIELDS.find(f => f.value === mapping.listingField)?.label}`}
                              </div>
                            )}
                          </div>
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
                  {uiLang === 'zh' ? '请选择左侧模板或上传新的亚马逊批量刊登文件 (.xlsm)。' : 'Select a template or upload a new Amazon batch file (.xlsm).'}
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
