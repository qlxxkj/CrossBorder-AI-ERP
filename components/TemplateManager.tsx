
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star, Filter, ArrowRightLeft, Database, Copy, Shuffle, ChevronDown, RefreshCcw, Tag } from 'lucide-react';
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

  const fetchTemplates = async (selectId?: string) => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setDbError(null);
    try {
      const { data, error: dbErr } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
      if (dbErr) {
        if (dbErr.code === '42703' || dbErr.message.toLowerCase().includes('mappings')) {
          setDbError('SCHEMA_INCOMPLETE');
        }
      }
      if (data) {
        setTemplates(data);
        if (selectId) {
          const newTemplate = data.find(t => t.id === selectId);
          if (newTemplate) setSelectedTemplate(newTemplate);
        }
      }
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
        
        let foundHeaders: string[] = [];
        let row8Defaults: Record<string, string> = {};
        let requiredHeaders: string[] = [];
        let fieldDefinitions: Record<string, { dataType?: string; acceptedValues?: string[] }> = {};
        let foundSheetName = "";

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

        const templateSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'template' || n.includes('模板'));
        if (templateSheetName) {
          const worksheet = workbook.Sheets[templateSheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          const row4 = jsonData[3];
          if (row4 && row4.length > 5) {
            foundHeaders = row4.map(h => String(h || '').trim()).filter(h => h !== '');
            foundSheetName = templateSheetName;

            const row8 = jsonData[7];
            if (row8) {
              foundHeaders.forEach((h, idx) => {
                if (row8[idx]) row8Defaults[h] = String(row8[idx]).trim();
              });
            }
          }
        }

        if (foundHeaders.length === 0) {
          throw new Error(uiLang === 'zh' ? "未能在 'Template' 工作表第 4 行识别到字段。" : "No headers on 'Template' sheet (Row 4).");
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please log in.");

        const initialMappings: Record<string, FieldMapping> = {};
        foundHeaders.forEach(h => {
          const lowerH = h.toLowerCase();
          const tplDefault = row8Defaults[h] || '';
          let source: 'listing' | 'custom' | 'template_default' = tplDefault ? 'template_default' : 'custom';
          let field = '';

          if (lowerH.includes('sku') || lowerH.includes('external_product_id')) { source = 'listing'; field = 'asin'; }
          else if (lowerH.includes('item_name') || lowerH === 'title') { source = 'listing'; field = 'title'; }
          else if (lowerH.includes('price')) { source = 'listing'; field = 'price'; }
          
          initialMappings[h] = {
            header: h,
            source,
            listingField: field,
            defaultValue: '',
            templateDefault: tplDefault,
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

        const { data: insertData, error: insErr } = await supabase.from('templates').insert([payload]).select();
        
        if (insErr && insErr.code === '42703') {
           setDbError('SCHEMA_INCOMPLETE');
           const { mappings, required_headers, ...fallback } = payload;
           const { data: fallbackData } = await supabase.from('templates').insert([fallback]).select();
           if (fallbackData) fetchTemplates(fallbackData[0]?.id);
        } else if (insertData) {
           fetchTemplates(insertData[0]?.id);
        }
        
        alert(uiLang === 'zh' ? "上传成功！已自动捕获第8行预设值。" : "Uploaded! Row 8 defaults captured.");

      } catch (err: any) {
        alert("Error: " + err.message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateMapping = (header: string, updates: Partial<FieldMapping>) => {
    if (!selectedTemplate) return;
    const newMappings = { ...(selectedTemplate.mappings || {}) };
    newMappings[header] = { ...newMappings[header], ...updates };
    setSelectedTemplate({ ...selectedTemplate, mappings: newMappings });
  };

  const filteredHeaders = useMemo(() => {
    if (!selectedTemplate) return [];
    let headers = selectedTemplate.headers || [];
    if (filterRequired) headers = headers.filter(h => selectedTemplate.required_headers?.includes(h));
    return headers;
  }, [selectedTemplate, filterRequired]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {dbError === 'SCHEMA_INCOMPLETE' && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2.5rem] flex items-center justify-between">
           <div className="flex items-center gap-4">
              <AlertCircle className="text-amber-500" />
              <p className="text-xs font-bold text-amber-800 uppercase tracking-widest">Database Outdated: Advanced Mapping Disabled. Run SQL fix.</p>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <Layout size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-bold">Amazon Flat File Engine &bull; Row 8 Parser Enabled</p>
          </div>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-2xl active:scale-95 disabled:opacity-50">
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {t('uploadTemplate')}
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsm, .xlsx" onChange={handleFileUpload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-320px)]">
        {/* List */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
            {loading ? <div className="flex justify-center pt-20"><Loader2 className="animate-spin text-indigo-500" /></div> : 
              templates.map(tmp => (
                <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`w-full p-6 rounded-3xl border text-left flex items-center justify-between transition-all group ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500/10' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                  <div className="flex items-center gap-4 overflow-hidden">
                    <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} size={24} />
                    <div className="flex flex-col">
                      <span className="font-black text-sm truncate max-w-[150px]">{tmp.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{tmp.headers?.length || 0} Columns</span>
                    </div>
                  </div>
                </button>
              ))
            }
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="font-black text-slate-900 truncate max-w-md">{selectedTemplate.name}</h3>
                  <p className="text-[9px] font-black text-indigo-500 uppercase mt-1">Smart Mapping Logic Active</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFilterRequired(!filterRequired)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border transition-all ${filterRequired ? 'bg-amber-500 text-white border-amber-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}>
                    <Filter size={14} /> {uiLang === 'zh' ? '必填筛选' : 'Required'}
                  </button>
                  <button onClick={async () => {
                    const { error } = await supabase.from('templates').update({ mappings: selectedTemplate.mappings }).eq('id', selectedTemplate.id);
                    if (!error) alert("Saved!");
                  }} className="px-10 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>
              </div>

              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                {filteredHeaders.map((h, i) => {
                  const isRequired = selectedTemplate.required_headers?.includes(h);
                  const mapping = selectedTemplate.mappings?.[h] || { header: h, source: 'custom' };
                  
                  return (
                    <div key={i} className={`p-6 rounded-[2rem] border transition-all hover:bg-white group ${isRequired ? 'bg-red-50/20 border-red-100' : 'bg-slate-50/30 border-slate-50'}`}>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-[11px] font-black break-all ${isRequired ? 'text-red-700' : 'text-slate-600'}`}>{h}</span>
                            {isRequired && <Star size={10} className="text-red-500 fill-red-500" />}
                            {mapping.dataType && <span className="text-[9px] px-2 py-0.5 bg-slate-100 rounded text-slate-400 font-black uppercase">{mapping.dataType}</span>}
                          </div>
                          {mapping.templateDefault && (
                             <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                <Database size={10}/> Row 8 Default: {mapping.templateDefault}
                             </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <select 
                              value={mapping.source}
                              onChange={(e) => updateMapping(h, { source: e.target.value as any, listingField: e.target.value === 'listing' ? 'asin' : '' })}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                           >
                              <option value="custom">Manual Custom Value</option>
                              <option value="template_default">Use Template Default (Row 8)</option>
                              <option value="listing">Map Listing Field</option>
                              <option value="random">🎲 Random Choice</option>
                           </select>

                           <div className="flex-1">
                              {mapping.source === 'listing' ? (
                                <select 
                                  value={mapping.listingField}
                                  onChange={(e) => updateMapping(h, { listingField: e.target.value })}
                                  className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-xs font-black"
                                >
                                  {LISTING_SOURCE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                              ) : mapping.source === 'custom' ? (
                                <input 
                                  type="text" 
                                  value={mapping.defaultValue || ''} 
                                  onChange={(e) => updateMapping(h, { defaultValue: e.target.value })}
                                  placeholder="Type custom value..."
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                />
                              ) : (
                                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                                   {mapping.source === 'random' ? <Shuffle size={14} /> : <Database size={14} />}
                                   {mapping.source === 'random' ? 'Will pick randomly from accepted values' : `Will use "${mapping.templateDefault}"`}
                                </div>
                              )}
                           </div>
                        </div>

                        {mapping.acceptedValues && mapping.acceptedValues.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                             <span className="text-[8px] font-black text-slate-300 uppercase flex items-center gap-1"><Tag size={8}/> Accepted:</span>
                             {mapping.acceptedValues.slice(0, 8).map((v, idx) => (
                               <span key={idx} className="text-[8px] px-2 py-0.5 bg-slate-50 text-slate-400 rounded-md font-bold">{v}</span>
                             ))}
                             {mapping.acceptedValues.length > 8 && <span className="text-[8px] text-slate-300 font-bold">+{mapping.acceptedValues.length - 8} more</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-30">
               <Settings2 size={64} className="mb-4" />
               <h4 className="font-black text-xl uppercase tracking-widest">{t('selectTemplate')}</h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
