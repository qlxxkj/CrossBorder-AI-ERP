
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
        let fieldDefinitions: Record<string, string[]> = {};
        
        // 1. Valid Values 解析 (深度递归解析合并单元格)
        const vvSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('valid values') || n.includes('有效值'));
        if (vvSheetName) {
          const sheet = workbook.Sheets[vvSheetName];
          const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          let fieldCol = -1, valCol = -1;
          
          for (let i = 0; i < Math.min(rawData.length, 25); i++) {
            const row = rawData[i];
            if (!row) continue;
            const fIdx = row.findIndex(c => String(c || '').toLowerCase().includes('field name') || String(c || '').includes('字段名称'));
            const vIdx = row.findIndex(c => String(c || '').toLowerCase().includes('valid value') || String(c || '').includes('有效值'));
            if (fIdx !== -1 && vIdx !== -1) { fieldCol = fIdx; valCol = vIdx; break; }
          }

          if (fieldCol !== -1 && valCol !== -1) {
            let lastFieldName = "";
            rawData.forEach(row => {
              if (!row) return;
              const fName = String(row[fieldCol] || '').trim();
              const vVal = String(row[valCol] || '').trim();
              if (fName && fName.toLowerCase() !== 'field name' && fName !== '字段名称') {
                lastFieldName = fName;
              }
              if (lastFieldName && vVal && vVal.toLowerCase() !== 'valid value' && vVal !== '有效值' && vVal.toLowerCase() !== 'none') {
                if (!fieldDefinitions[lastFieldName]) fieldDefinitions[lastFieldName] = [];
                if (!fieldDefinitions[lastFieldName].includes(vVal)) fieldDefinitions[lastFieldName].push(vVal);
              }
            });
          }
        }

        // 2. Data Definitions 解析 (必填项)
        const defSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('data definitions') || n.includes('数据定义'));
        if (defSheetName) {
          const sheet = workbook.Sheets[defSheetName];
          const defData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          let nameIdx = -1, reqIdx = -1;
          for (let i = 0; i < Math.min(defData.length, 10); i++) {
            const row = defData[i];
            if (!row) continue;
            const nIdx = row.findIndex(c => String(c || '').toLowerCase().includes('field name') || String(c || '').includes('字段名称'));
            const rIdx = row.findIndex(c => String(c || '').toLowerCase().includes('required') || String(c || '').includes('必填'));
            if (nIdx !== -1) { nameIdx = nIdx; reqIdx = rIdx; break; }
          }
          if (nameIdx !== -1 && reqIdx !== -1) {
            defData.forEach(row => {
              const n = String(row[nameIdx] || '').trim();
              const r = String(row[reqIdx] || '').toLowerCase();
              if (n && (r.includes('required') || r.includes('yes') || r.includes('必填'))) requiredHeaders.push(n);
            });
          }
        }

        // 3. Template 解析 (保持原始表头，不增加后缀)
        const tplSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'template' || n.includes('模板'));
        if (!tplSheetName) throw new Error("Template sheet not found");
        const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[tplSheetName], { header: 1, defval: '' });
        const row4 = jsonData[3];
        if (!row4) throw new Error("Row 4 headers not found");
        
        foundHeaders = row4.map(h => String(h || '').trim()).filter(h => h !== '');
        const row8 = jsonData[7];

        const mappings: Record<string, FieldMapping> = {};
        let otherImageIdx = 0;
        let bulletIdx = 0;

        // 使用 index 确保唯一映射
        foundHeaders.forEach((h, i) => {
          const tplDefault = row8?.[i] ? String(row8[i]).trim() : '';
          const lowerH = h.toLowerCase();
          const mappingKey = `${h}_idx_${i}`; // 关键：使用带索引的Key

          let source: any = tplDefault ? 'template_default' : 'custom';
          let field = '';

          // 自动识别
          if (lowerH.includes('sku') || lowerH.includes('external_product_id')) { source = 'listing'; field = 'asin'; }
          else if (lowerH.includes('item_name') || lowerH === 'title' || lowerH.includes('product_name')) { source = 'listing'; field = 'title'; }
          else if (lowerH.includes('brand')) { source = 'listing'; field = 'brand'; }
          else if (lowerH.match(/main_image_url|main_image_location|main.image|主图/)) { source = 'listing'; field = 'main_image'; }
          else if (lowerH.match(/other_image_url|other_image_location|other.image|附图/)) { 
            otherImageIdx++;
            source = 'listing'; 
            field = `other_image${otherImageIdx}`; 
          }
          else if (lowerH.match(/bullet_point|bullet.point|商品要点/)) {
            bulletIdx++;
            source = 'listing';
            field = `feature${bulletIdx}`;
          }

          mappings[mappingKey] = {
            header: h,
            source,
            listingField: field,
            defaultValue: tplDefault,
            templateDefault: tplDefault,
            acceptedValues: fieldDefinitions[h] || []
          };
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Auth required");

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
        alert(uiLang === 'zh' ? "模板上传解析成功！" : "Upload Success!");
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsUploading(false);
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

  const updateMapping = (key: string, updates: Partial<FieldMapping>) => {
    if (!selectedTemplate) return;
    const newMappings = { ...(selectedTemplate.mappings || {}) };
    newMappings[key] = { ...newMappings[key], ...updates };
    setSelectedTemplate({ ...selectedTemplate, mappings: newMappings });
  };

  const filteredItems = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.headers.map((h, i) => ({ header: h, index: i, key: `${h}_idx_${i}` }))
      .filter(item => {
        const matchSearch = item.header.toLowerCase().includes(searchQuery.toLowerCase());
        const matchRequired = filterRequired ? selectedTemplate.required_headers?.includes(item.header) : true;
        return matchSearch && matchRequired;
      });
  }, [selectedTemplate, searchQuery, filterRequired]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-inter">
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
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('manageTemplates')}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
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
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    if(confirm("Delete?")) {
                       await supabase.from('templates').delete().eq('id', tmp.id);
                       fetchTemplates();
                    }
                  }} className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

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
                    alert("Saved!");
                  }} className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="text" placeholder="Search fields..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" />
                  </div>
                  <button onClick={() => setFilterRequired(!filterRequired)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border transition-all ${filterRequired ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                    <Filter size={14} /> {filterRequired ? 'Required Only' : 'All Fields'}
                  </button>
                </div>
              </div>

              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {filteredItems.map(({ header, key }) => {
                  const isRequired = selectedTemplate.required_headers?.includes(header);
                  const mapping = selectedTemplate.mappings?.[key] || { header, source: 'custom', defaultValue: '' };
                  const hasOptions = mapping.acceptedValues && mapping.acceptedValues.length > 0;

                  return (
                    <div key={key} className={`p-6 rounded-[2rem] border transition-all ${isRequired ? 'bg-red-50/10 border-red-100' : 'bg-slate-50/30 border-slate-50'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <span className={`text-[11px] font-black break-all ${isRequired ? 'text-red-700' : 'text-slate-600'}`}>{header}</span>
                             {isRequired && <Star size={10} className="text-red-500 fill-red-500" />}
                          </div>
                        </div>

                        <select 
                          value={mapping.source}
                          onChange={(e) => updateMapping(key, { source: e.target.value as any })}
                          className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none"
                        >
                          <option value="custom">Manual Value / Choice</option>
                          <option value="template_default">Template Default (Row 8)</option>
                          <option value="listing">Map to Listing Field</option>
                          <option value="random">🎲 Random Generate</option>
                        </select>

                        <div className="flex-1">
                          {mapping.source === 'listing' ? (
                            <select value={mapping.listingField} onChange={(e) => updateMapping(key, { listingField: e.target.value })} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black shadow-sm">
                              <option value="">-- Choose Data --</option>
                              {LISTING_SOURCE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          ) : mapping.source === 'custom' && hasOptions ? (
                            <select value={mapping.defaultValue || ''} onChange={(e) => updateMapping(key, { defaultValue: e.target.value })} className="w-full px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[11px] font-black shadow-sm">
                                <option value="">-- Select Option --</option>
                                {mapping.acceptedValues?.map((v, idx) => <option key={idx} value={v}>{v}</option>)}
                            </select>
                          ) : mapping.source === 'custom' ? (
                            <input type="text" value={mapping.defaultValue || ''} onChange={(e) => updateMapping(key, { defaultValue: e.target.value })} placeholder="Value..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold" />
                          ) : (
                            <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                               {mapping.source === 'random' ? <Shuffle size={14} /> : <Database size={14} />}
                               {mapping.source === 'random' ? 'Smart Generator' : `Default: ${mapping.templateDefault || 'EMPTY'}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20"><Layout size={64} className="mb-4" /></div>
          )}
        </div>
      </div>
    </div>
  );
};
