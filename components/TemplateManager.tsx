
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star, Filter, ArrowRightLeft, Database, Copy, Shuffle, ChevronDown, RefreshCcw, Tag, ListFilter, Search, Globe, X } from 'lucide-react';
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
  { value: 'other_image2', label: 'Other Image 2' },
  { value: 'other_image3', label: 'Other Image 3' },
  { value: 'other_image4', label: 'Other Image 4' },
  { value: 'other_image5', label: 'Other Image 5' },
  { value: 'other_image6', label: 'Other Image 6' },
  { value: 'other_image7', label: 'Other Image 7' },
  { value: 'other_image8', label: 'Other Image 8' },
  { value: 'other_image9', label: 'Other Image 9' },
  { value: 'weight', label: 'Item Weight' },
  { value: 'dimensions', label: 'Dimensions' },
];

const MARKETPLACES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
];

export const TemplateManager: React.FC<TemplateManagerProps> = ({ uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRequired, setFilterRequired] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (selectId?: string) => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
      if (data) {
        setTemplates(data);
        if (selectId) {
          const found = data.find(t => t.id === selectId);
          if (found) setSelectedTemplate(found);
        } else if (!selectedTemplate && data.length > 0) {
          setSelectedTemplate(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(uiLang === 'zh' ? "确定要删除该模板吗？" : "Delete this template?")) return;
    try {
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (!error) {
        if (selectedTemplate?.id === id) setSelectedTemplate(null);
        fetchTemplates();
      }
    } catch (err: any) {
      alert(err.message);
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
        
        // 1. Valid Values 解析
        const validValuesSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('valid values') || n.includes('有效值'));
        if (validValuesSheet) {
          const sheet = workbook.Sheets[validValuesSheet];
          const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          let fieldCol = -1, valCol = -1;
          
          // 查找表头
          for (let i = 0; i < Math.min(rawData.length, 15); i++) {
            const row = rawData[i];
            if (!row) continue;
            row.forEach((cell, idx) => {
              const s = String(cell || '').toLowerCase();
              if (s.includes('field name') || s.includes('字段名称')) fieldCol = idx;
              if (s.includes('valid value') || s.includes('有效值')) valCol = idx;
            });
            if (fieldCol !== -1 && valCol !== -1) break;
          }

          if (fieldCol !== -1 && valCol !== -1) {
            rawData.forEach(row => {
              const fName = String(row[fieldCol] || '').trim();
              const vVal = String(row[valCol] || '').trim();
              if (fName && vVal && vVal.toLowerCase() !== 'none' && vVal.toLowerCase() !== '字段名称') {
                if (!fieldDefinitions[fName]) fieldDefinitions[fName] = { acceptedValues: [] };
                // 拆分可能存在的一个单元格内多个值的情况
                const parts = vVal.split(/,|\n/).map(v => v.trim()).filter(v => v !== '');
                parts.forEach(p => {
                  if (!fieldDefinitions[fName].acceptedValues?.includes(p)) {
                    fieldDefinitions[fName].acceptedValues?.push(p);
                  }
                });
              }
            });
          }
        }

        // 2. Data Definitions 解析 (必填项)
        const definitionsSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('data definitions') || n.includes('数据定义'));
        if (definitionsSheet) {
          const sheet = workbook.Sheets[definitionsSheet];
          const defData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          let nameIdx = -1, reqIdx = -1;
          for (let i = 0; i < Math.min(defData.length, 5); i++) {
            defData[i]?.forEach((c, idx) => {
              const s = String(c || '').toLowerCase();
              if (s.includes('field name') || s.includes('字段名称')) nameIdx = idx;
              if (s.includes('required') || s.includes('必填')) reqIdx = idx;
            });
            if (nameIdx !== -1) break;
          }
          if (nameIdx !== -1 && reqIdx !== -1) {
            defData.forEach(row => {
              const n = String(row[nameIdx] || '').trim();
              const r = String(row[reqIdx] || '').toLowerCase();
              if (n && (r.includes('required') || r.includes('yes') || r.includes('必填'))) {
                requiredHeaders.push(n);
              }
            });
          }
        }

        // 3. Template 解析
        const templateSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'template' || n.includes('模板'));
        if (templateSheetName) {
          const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[templateSheetName], { header: 1, defval: '' });
          const row4 = jsonData[3];
          if (row4) {
            foundHeaders = row4.map(h => String(h || '').trim()).filter(h => h !== '');
            const row8 = jsonData[7];
            if (row8) {
              foundHeaders.forEach((h, idx) => { if (row8[idx]) row8Defaults[h] = String(row8[idx]).trim(); });
            }
          }
        }

        if (foundHeaders.length === 0) throw new Error("Could not find headers in Row 4 of 'Template' sheet.");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Auth required");

        const mappings: Record<string, FieldMapping> = {};
        let otherImageCount = 0;
        let bulletCount = 0;

        foundHeaders.forEach(h => {
          const tplDefault = row8Defaults[h] || '';
          const lowerH = h.toLowerCase();
          let source: any = tplDefault ? 'template_default' : 'custom';
          let field = '';

          // 自动映射逻辑：识别图片和 Bullet Points 并自动递增索引
          if (lowerH.includes('sku') || lowerH.includes('external_product_id')) { source = 'listing'; field = 'asin'; }
          else if (lowerH.includes('item_name') || lowerH === 'title' || lowerH.includes('product_name')) { source = 'listing'; field = 'title'; }
          else if (lowerH.includes('standard_price') || lowerH === 'price') { source = 'listing'; field = 'price'; }
          else if (lowerH.includes('brand')) { source = 'listing'; field = 'brand'; }
          else if (lowerH.match(/main_image_url|main.image|主图/)) { source = 'listing'; field = 'main_image'; }
          else if (lowerH.match(/other_image_url|other.image|附图/)) { 
            otherImageCount++;
            source = 'listing'; 
            field = `other_image${otherImageCount}`; 
          }
          else if (lowerH.match(/bullet_point|bullet.point|商品要点/)) {
            bulletCount++;
            source = 'listing';
            field = `feature${bulletCount}`;
          }

          mappings[h] = {
            header: h,
            source,
            listingField: field,
            defaultValue: tplDefault,
            templateDefault: tplDefault,
            acceptedValues: fieldDefinitions[h]?.acceptedValues
          };
        });

        const { data: inserted } = await supabase.from('templates').insert([{
          user_id: session.user.id,
          name: file.name,
          headers: foundHeaders,
          required_headers: requiredHeaders,
          mappings: mappings,
          marketplace: "US",
          created_at: new Date().toISOString()
        }]).select();

        if (inserted) fetchTemplates(inserted[0].id);
        alert(uiLang === 'zh' ? "模板上传并解析成功！" : "Upload & Parse Success!");

      } catch (err: any) {
        alert("Upload Error: " + err.message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateSelectedTemplate = async (updates: Partial<ExportTemplate>) => {
    if (!selectedTemplate) return;
    const newTpl = { ...selectedTemplate, ...updates };
    setSelectedTemplate(newTpl);
    await supabase.from('templates').update(updates).eq('id', selectedTemplate.id);
  };

  const updateMapping = (header: string, updates: Partial<FieldMapping>) => {
    if (!selectedTemplate) return;
    const newMappings = { ...(selectedTemplate.mappings || {}) };
    newMappings[header] = { ...newMappings[header], ...updates };
    setSelectedTemplate({ ...selectedTemplate, mappings: newMappings });
  };

  const filteredHeaders = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.headers.filter(h => {
      const matchSearch = h.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRequired = filterRequired ? selectedTemplate.required_headers?.includes(h) : true;
      return matchSearch && matchRequired;
    });
  }, [selectedTemplate, searchQuery, filterRequired]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-inter">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Marketplace Template Engine</p>
          </div>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl active:scale-95 disabled:opacity-50">
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {t('uploadTemplate')}
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsm,.xlsx" onChange={handleFileUpload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-320px)]">
        {/* Sidebar: Template List */}
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {templates.length === 0 && !loading && (
              <div className="py-20 text-center opacity-20">
                <Info size={32} className="mx-auto mb-2" />
                <p className="text-xs font-black uppercase">No Templates</p>
              </div>
            )}
            {templates.map(tmp => (
              <div key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`group relative w-full p-5 rounded-3xl border cursor-pointer transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500/10' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedTemplate?.id === tmp.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Database size={18} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-xs truncate">{tmp.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{tmp.marketplace} &bull; {tmp.headers.length} Cols</p>
                  </div>
                  <button onClick={(e) => handleDeleteTemplate(tmp.id, e)} className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Editor */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-black text-slate-900 text-lg">{selectedTemplate.name}</h3>
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1 gap-2">
                       <Globe size={14} className="text-slate-400" />
                       <select 
                         value={selectedTemplate.marketplace} 
                         onChange={(e) => updateSelectedTemplate({ marketplace: e.target.value })}
                         className="text-[10px] font-black bg-transparent outline-none cursor-pointer uppercase"
                       >
                         {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.code}</option>)}
                       </select>
                    </div>
                  </div>
                  <button onClick={async () => {
                    await supabase.from('templates').update({ mappings: selectedTemplate.mappings }).eq('id', selectedTemplate.id);
                    alert("Settings Synchronized!");
                  }} className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search field name (e.g. image, price, action)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <button onClick={() => setFilterRequired(!filterRequired)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border transition-all ${filterRequired ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                    <Filter size={14} /> {filterRequired ? 'Required Only' : 'All Fields'}
                  </button>
                </div>
              </div>

              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {filteredHeaders.map((h, i) => {
                  const isRequired = selectedTemplate.required_headers?.includes(h);
                  const mapping = selectedTemplate.mappings?.[h] || { header: h, source: 'custom', defaultValue: '' };
                  const hasOptions = mapping.acceptedValues && mapping.acceptedValues.length > 0;

                  return (
                    <div key={i} className={`p-6 rounded-[2rem] border transition-all ${isRequired ? 'bg-red-50/10 border-red-100 shadow-[inset_0_0_20px_rgba(239,68,68,0.01)]' : 'bg-slate-50/30 border-slate-50'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <span className={`text-[11px] font-black break-all ${isRequired ? 'text-red-700' : 'text-slate-600'}`}>{h}</span>
                             {isRequired && <Star size={10} className="text-red-500 fill-red-500" />}
                          </div>
                          {mapping.templateDefault && <p className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block uppercase mt-1">Row 8 Default: {mapping.templateDefault}</p>}
                        </div>

                        <select 
                          value={mapping.source}
                          onChange={(e) => updateMapping(h, { source: e.target.value as any })}
                          className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                        >
                          <option value="custom">Manual Value / Choice</option>
                          <option value="template_default">Template Default (Row 8)</option>
                          <option value="listing">Map to Listing Field</option>
                          <option value="random">🎲 Random Choice (Valid Only)</option>
                        </select>

                        <div className="flex-1">
                          {mapping.source === 'listing' ? (
                            <select 
                              value={mapping.listingField}
                              onChange={(e) => updateMapping(h, { listingField: e.target.value })}
                              className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black shadow-sm"
                            >
                              <option value="">-- Choose Data --</option>
                              {LISTING_SOURCE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          ) : mapping.source === 'custom' ? (
                            hasOptions ? (
                              <select
                                value={mapping.defaultValue || ''}
                                onChange={(e) => updateMapping(h, { defaultValue: e.target.value })}
                                className="w-full px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[11px] font-black shadow-sm"
                              >
                                <option value="">-- Select Valid Option --</option>
                                {mapping.acceptedValues?.map((v, idx) => <option key={idx} value={v}>{v}</option>)}
                              </select>
                            ) : (
                              <input 
                                type="text" 
                                value={mapping.defaultValue || ''} 
                                onChange={(e) => updateMapping(h, { defaultValue: e.target.value })}
                                placeholder="Manual value..."
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold"
                              />
                            )
                          ) : (
                            <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                               {mapping.source === 'random' ? <Shuffle size={14} /> : <Database size={14} />}
                               {mapping.source === 'random' ? 'Validated AI Choice' : `Using "${mapping.templateDefault || 'EMPTY'}"`}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {hasOptions && (
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100/50 mt-4">
                           <span className="text-[8px] font-black text-slate-300 uppercase flex items-center gap-1"><Tag size={8}/> Valid Options:</span>
                           {mapping.acceptedValues?.slice(0, 12).map((v, idx) => (
                             <span key={idx} className="text-[8px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-bold border border-slate-200/50">{v}</span>
                           ))}
                           {(mapping.acceptedValues?.length || 0) > 12 && <span className="text-[8px] text-slate-300 font-bold">... +{mapping.acceptedValues!.length - 12}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
              <Layout size={64} className="mb-4" />
              <h4 className="font-black text-xl uppercase tracking-widest">Select a template to configure</h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
