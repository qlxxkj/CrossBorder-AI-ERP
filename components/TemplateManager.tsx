
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star, Filter, ArrowRightLeft, Database, Copy, Shuffle, ChevronDown } from 'lucide-react';
import { ExportTemplate, UILanguage, FieldMapping } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface TemplateManagerProps {
  uiLang: UILanguage;
}

// 可选的 Listing 字段列表
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
        let fieldDefinitions: Record<string, { dataType?: string; acceptedValues?: string[] }> = {};
        let foundSheetName = "";

        // 1. 解析 Data Definitions
        const definitionsSheet = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('data definitions') || n.includes('数据定义')
        );
        if (definitionsSheet) {
          const sheet = workbook.Sheets[definitionsSheet];
          const defData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          let colMap: Record<string, number> = {};
          for (let i = 0; i < Math.min(defData.length, 30); i++) {
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
                acceptedValues: row[colMap.accepted] ? String(row[colMap.accepted]).split(',').map(v => v.trim()) : undefined
              };
            });
          }
        }

        // 2. 解析 Template Sheet
        const amazonKeywords = ['item_sku', 'sku', 'external_product_id', 'feed_product_type'];
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (jsonData[3] && jsonData[3].some(c => amazonKeywords.some(k => String(c).toLowerCase().includes(k)))) {
            foundHeaders = jsonData[3].map(h => String(h || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim()).filter(h => h !== '');
            foundSheetName = sheetName;
            break;
          }
        }

        if (foundHeaders.length === 0) throw new Error("No headers found on Row 4.");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please log in first.");

        // 初始化映射
        const initialMappings: Record<string, FieldMapping> = {};
        foundHeaders.forEach(h => {
          const lowerH = h.toLowerCase();
          let source: 'listing' | 'custom' = 'custom';
          let field = '';

          // 自动识别常见字段
          if (lowerH.includes('sku') || lowerH.includes('external_product_id')) { source = 'listing'; field = 'asin'; }
          else if (lowerH.includes('item_name') || lowerH === 'title') { source = 'listing'; field = 'title'; }
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

        const newTemplatePayload: any = {
          user_id: session.user.id,
          name: `${file.name.replace(/\.[^/.]+$/, "")} (${foundSheetName})`,
          headers: foundHeaders,
          required_headers: requiredHeaders,
          mappings: initialMappings,
          default_values: {},
          marketplace: "US",
          created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured()) {
          const { error: insError } = await supabase.from('templates').insert([newTemplatePayload]);
          if (insError && (insError.code === '42703' || insError.message.includes('required_headers'))) {
            const { required_headers, mappings, ...fallback } = newTemplatePayload;
            await supabase.from('templates').insert([fallback]);
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

  const updateMapping = (header: string, updates: Partial<FieldMapping>) => {
    if (!selectedTemplate) return;
    const newMappings = { ...selectedTemplate.mappings };
    newMappings[header] = { ...newMappings[header], ...updates };
    setSelectedTemplate({ ...selectedTemplate, mappings: newMappings });
  };

  const saveTemplate = async () => {
    if (!selectedTemplate || !isSupabaseConfigured()) return;
    const { error } = await supabase
      .from('templates')
      .update({ mappings: selectedTemplate.mappings })
      .eq('id', selectedTemplate.id);
    
    if (error) alert(error.message);
    else {
      alert(uiLang === 'zh' ? "映射关系已同步" : "Mapping synced!");
      fetchTemplates();
    }
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
      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <Layout size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-bold">Smart Amazon Mapping Engine &bull; Auto-definitions</p>
          </div>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-2xl disabled:opacity-50">
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
              templates.map(tmp => (
                <button key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`w-full p-5 rounded-3xl border text-left flex items-center justify-between transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/10' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                  <div className="flex items-center gap-4 overflow-hidden">
                    <FileSpreadsheet className={selectedTemplate?.id === tmp.id ? 'text-indigo-600' : 'text-slate-300'} size={24} />
                    <div className="flex flex-col">
                      <span className="font-black text-sm truncate">{tmp.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{tmp.required_headers?.length || 0} Required</span>
                    </div>
                  </div>
                </button>
              ))
            }
          </div>
        </div>

        {/* Mapping Editor */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-slate-900 truncate max-w-md">{selectedTemplate.name}</h3>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFilterRequired(!filterRequired)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border ${filterRequired ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                    <Filter size={14} /> {uiLang === 'zh' ? '只看必填' : 'Required'}
                  </button>
                  <button onClick={saveTemplate} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl active:scale-95 transition-all">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex gap-4">
                    <ArrowRightLeft className="text-blue-500 shrink-0" size={20} />
                    <p className="text-[11px] font-bold text-blue-700 uppercase leading-relaxed">
                      {uiLang === 'zh' ? '映射逻辑：你可以将采集到的 Listing 字段直接映射到亚马逊模板的特定列中。' : 'Mapping Logic: Map listing fields directly to Amazon template columns.'}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-5 rounded-3xl border border-purple-100 flex gap-4">
                    <Shuffle className="text-purple-500 shrink-0" size={20} />
                    <p className="text-[11px] font-bold text-purple-700 uppercase leading-relaxed">
                      {uiLang === 'zh' ? '随机填充：勾选后，若字段为空且有可选值定义，系统将在导出时随机挑选一个。' : 'Random Logic: System will pick a value if field is empty and constraints exist.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredHeaders.map((h, i) => {
                    const isRequired = selectedTemplate.required_headers?.includes(h);
                    const mapping = selectedTemplate.mappings?.[h] || { header: h, source: 'custom' };
                    
                    return (
                      <div key={i} className={`p-5 rounded-3xl border transition-all ${isRequired ? 'bg-red-50/20 border-red-100' : 'bg-slate-50/30 border-slate-100'}`}>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                          <div className="sm:w-1/4 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-black break-all leading-tight ${isRequired ? 'text-red-700' : 'text-slate-600'}`}>{h}</span>
                              {isRequired && <Star size={10} className="text-red-500 fill-red-500" />}
                            </div>
                            {mapping.dataType && <span className="text-[9px] text-slate-400 font-bold uppercase">{mapping.dataType}</span>}
                          </div>

                          <div className="sm:w-1/3">
                            <select 
                              value={mapping.source === 'listing' ? mapping.listingField : 'custom'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') updateMapping(h, { source: 'custom', listingField: '' });
                                else updateMapping(h, { source: 'listing', listingField: val });
                              }}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                            >
                              <option value="custom">Custom / Static Value</option>
                              <optgroup label="Listing Data Source">
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
                                placeholder="Static value..."
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                              />
                            ) : (
                              <div className="flex items-center gap-3 w-full">
                                <div className="flex-1 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black text-indigo-600 uppercase">
                                  Mapped to {LISTING_SOURCE_FIELDS.find(f => f.value === mapping.listingField)?.label}
                                </div>
                                <button 
                                  onClick={() => updateMapping(h, { source: mapping.source === 'random' ? 'listing' : 'random' })}
                                  className={`p-2.5 rounded-xl border transition-all ${mapping.source === 'random' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-slate-300 border-slate-200 hover:text-purple-500'}`}
                                  title="Enable Random Generation if data is missing"
                                >
                                  <Shuffle size={18} />
                                </button>
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
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-40">
               <Settings2 size={64} className="mb-4" />
               <p className="font-black text-xl">{t('selectTemplate')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
