
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star, Filter, ArrowRightLeft, Database, Copy, Shuffle, ChevronDown, RefreshCcw, Tag, ListFilter, Search, Globe, X, DatabaseZap } from 'lucide-react';
import { ExportTemplate, UILanguage, FieldMapping } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface TemplateManagerProps {
  uiLang: UILanguage;
}

const LISTING_SOURCE_FIELDS = [
  { value: 'asin', label: 'ASIN / SKU' },
  { value: 'title', label: 'Title (Optimized or Cleaned)' },
  { value: 'price', label: 'Standard Price' },
  { value: 'shipping', label: 'Shipping Cost' },
  { value: 'brand', label: 'Brand Name' },
  { value: 'description', label: 'Description (Optimized or Cleaned)' },
  { value: 'item_weight_value', label: 'Item Weight Value' },
  { value: 'item_weight_unit', label: 'Item Weight Unit' },
  { value: 'item_length', label: 'Item Length' },
  { value: 'item_width', label: 'Item Width' },
  { value: 'item_height', label: 'Item Height' },
  { value: 'item_size_unit', label: 'Item Size Unit' },
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
];

const HIGH_CONFIDENCE_KEYWORDS = [
  'sku', 'item_sku', 'external_product_id', 'product_id', 'identificador_de_producto', 'feed_product_type'
];

function safeEncode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const findAmazonTemplateSheet = (workbook: XLSX.WorkBook): string => {
  const sheetNames = workbook.SheetNames;
  let bestSheet = '';
  let maxScore = -1;

  for (const name of sheetNames) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('instruction') || lowerName.includes('notice') || lowerName.includes('definitions') || lowerName.includes('valid values')) continue;

    const sheet = workbook.Sheets[name];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: '' });
    
    let sheetContentMaxScore = 0;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;
      const rowStr = row.map(c => String(c || '').toLowerCase()).join('|');
      
      let rowScore = 0;
      HIGH_CONFIDENCE_KEYWORDS.forEach(kw => { if (rowStr.includes(kw)) rowScore += 20; });
      if (rowScore > sheetContentMaxScore) sheetContentMaxScore = rowScore;
    }

    if (sheetContentMaxScore > maxScore) {
      maxScore = sheetContentMaxScore;
      bestSheet = name;
    }
  }

  return bestSheet || sheetNames[0];
};

const findHeaderRowIndex = (rows: any[][]): number => {
  if (rows[4]) {
    const rowStr = rows[4].map(c => String(c || '').toLowerCase()).join('|');
    if (HIGH_CONFIDENCE_KEYWORDS.some(kw => rowStr.includes(kw))) return 4;
  }
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue; 
    const rowStr = row.map(c => String(c || '').toLowerCase()).join('|');
    let score = 0;
    HIGH_CONFIDENCE_KEYWORDS.forEach(kw => { if (rowStr.includes(kw)) score += 30; });
    const underscoreCount = (rowStr.match(/_/g) || []).length;
    if (underscoreCount > 8) score += 20;
    if (score >= 50) return i;
  }
  return 4;
};

export const TemplateManager: React.FC<TemplateManagerProps> = ({ uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async (selectId?: string) => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Error fetching templates:", error);
      setLoading(false);
      return;
    }
    if (data) {
      setTemplates(data);
      if (selectId) {
        const found = data.find(t => t.id === selectId);
        if (found) setSelectedTemplate(found);
      } else if (!selectedTemplate && data.length > 0) {
        setSelectedTemplate(data[0]);
      }
    }
    setLoading(false);
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm(uiLang === 'zh' ? "确定要删除该模板吗？" : "Are you sure you want to delete this template?")) return;
    try {
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
    } catch (err: any) { alert("Delete failed: " + err.message); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(bytes, { type: 'array', cellNF: true, cellText: true, cellStyles: true, bookVBA: true });
        const base64File = safeEncode(bytes);

        const sheetName = findAmazonTemplateSheet(workbook);
        const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
        
        const techRowIdx = findHeaderRowIndex(jsonData);
        const techRow = jsonData[techRowIdx];
        const humanRow = (techRowIdx > 1) ? jsonData[techRowIdx - 2] : (techRowIdx > 0 ? jsonData[techRowIdx - 1] : techRow);
        const exampleRow = jsonData[techRowIdx + 1] || [];

        const noticeRowIdx = techRowIdx + 2;
        const potentialNotice = jsonData[noticeRowIdx] || [];
        const noticeStr = potentialNotice.map(c => String(c || '')).join(' ');
        const hasNotice = noticeStr.includes("✅") || noticeStr.includes("❌") || noticeStr.toLowerCase().includes("prefilled") || noticeStr.toLowerCase().includes("mandatory");

        if (!techRow || techRow.length < 2) {
          throw new Error("Could not detect tech headers. Ensure Row 5 contains field names like 'item_sku'.");
        }

        const foundHeaders = humanRow.map((h, idx) => String(h || techRow[idx] || '').trim());
        const mappings: Record<string, any> = {};
        let imgCount = 0, bulletCount = 0;

        foundHeaders.forEach((h, i) => {
          const apiField = String(techRow[i] || '').toLowerCase().trim();
          if (!apiField) return;

          const key = `col_${i}`;
          const exampleVal = String(exampleRow[i] || '').trim();
          
          let source: any = 'custom';
          let field = '';

          if (apiField.includes('sku') || apiField.includes('external_product_id')) { source = 'listing'; field = 'asin'; }
          else if (apiField.includes('item_name') || apiField === 'title' || apiField.includes('product_name')) { source = 'listing'; field = 'title'; }
          else if (apiField.match(/image_url|image_location|附图/)) { 
            imgCount++;
            source = 'listing'; 
            field = imgCount === 1 ? 'main_image' : `other_image${imgCount - 1}`; 
          }
          else if (apiField.match(/bullet_point|商品要点/)) {
            bulletCount++;
            source = 'listing';
            field = `feature${bulletCount}`;
          }
          else if (apiField.includes('standard_price')) { source = 'listing'; field = 'price'; }
          else if (apiField.includes('description')) { source = 'listing'; field = 'description'; }

          mappings[key] = {
            header: h, 
            source,
            listingField: field,
            defaultValue: '', 
            templateDefault: exampleVal,
            acceptedValues: []
          };
        });

        mappings['__binary'] = base64File;
        mappings['__header_row_idx'] = techRowIdx;
        mappings['__sheet_name'] = sheetName;
        mappings['__has_prefill_notice'] = hasNotice;

        const { data: { session } } = await supabase.auth.getSession();
        const { data: inserted, error: insertError } = await supabase.from('templates').insert([{
          user_id: session?.user?.id,
          name: file.name,
          headers: foundHeaders,
          mappings: mappings,
          marketplace: "ALL",
          created_at: new Date().toISOString()
        }]).select();

        if (insertError) throw new Error(insertError.message);
        if (inserted && inserted.length > 0) {
          await fetchTemplates(inserted[0].id);
          alert(uiLang === 'zh' ? "模板上传并解析成功！" : "Template uploaded and parsed!");
        }
      } catch (err: any) {
        alert("Upload failed: " + err.message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateMapping = (key: string, updates: Partial<FieldMapping>) => {
    if (!selectedTemplate) return;
    const newMappings = { ...(selectedTemplate.mappings || {}) };
    newMappings[key] = { ...newMappings[key], ...updates };
    setSelectedTemplate({ ...selectedTemplate, mappings: newMappings });
  };

  const saveMappings = async () => {
    if (!selectedTemplate) return;
    const { error } = await supabase.from('templates').update({ 
        mappings: selectedTemplate.mappings 
    }).eq('id', selectedTemplate.id);
    if (error) alert("Save failed: " + error.message);
    else alert(uiLang === 'zh' ? "配置已保存！" : "Configuration saved!");
  };

  const filteredFields = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.headers.map((h, i) => ({ header: h, index: i }))
      .filter(item => item.header && item.header.toLowerCase().includes(fieldSearchQuery.toLowerCase()));
  }, [selectedTemplate, fieldSearchQuery]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-inter">
      <div className="flex items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Amazon Master Template Engine (XLSM Support)</p>
          </div>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all active:scale-95">
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          {t('uploadTemplate')}
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsm,.xlsx" onChange={handleFileUpload} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-320px)]">
        <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">{t('manageTemplates')}</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input type="text" placeholder={uiLang === 'zh' ? "搜索模板..." : "Search..."} value={templateSearchQuery} onChange={(e) => setTemplateSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {templates.filter(tmp => tmp.name.toLowerCase().includes(templateSearchQuery.toLowerCase())).map(tmp => (
              <div key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`group relative p-5 rounded-3xl border cursor-pointer transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500/10' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 overflow-hidden pr-2">
                    <p className="font-black text-xs truncate">{tmp.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Row {tmp.mappings?.__header_row_idx + 1} Tech</p>
                  </div>
                  <button onClick={(e) => handleDeleteTemplate(e, tmp.id)} className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col">
                  <h3 className="font-black text-slate-900 text-lg">{selectedTemplate.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                     <span className="text-[9px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-widest">Header Row: {selectedTemplate.mappings?.__header_row_idx + 1}</span>
                     <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${selectedTemplate.mappings?.__has_prefill_notice ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
                        {selectedTemplate.mappings?.__has_prefill_notice ? 'With Notice Row' : 'Direct Entry'}
                     </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder={uiLang === 'zh' ? "搜索字段..." : "Search fields..."} value={fieldSearchQuery} onChange={(e) => setFieldSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none shadow-inner" />
                  </div>
                  <button onClick={saveMappings} className="px-8 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {filteredFields.map(({ header: h, index: i }) => {
                  const key = `col_${i}`;
                  const mapping = selectedTemplate.mappings?.[key] || { header: h, source: 'custom', defaultValue: '' };
                  return (
                    <div key={key} className="p-6 rounded-[2rem] border bg-slate-50/30 border-slate-50 transition-all hover:border-indigo-100">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="space-y-1">
                          <span className="text-[11px] font-black text-slate-600 break-all">{h}</span>
                          <p className="text-[8px] font-black text-slate-400 uppercase">Column Index: {i + 1}</p>
                        </div>
                        <select value={mapping.source} onChange={(e) => updateMapping(key, { source: e.target.value as any })} className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none cursor-pointer hover:border-indigo-300">
                          <option value="custom">Manual Value</option>
                          <option value="listing">Listing Data</option>
                          <option value="template_default">Template Default</option>
                          <option value="random">Random Generate</option>
                        </select>
                        <div className="flex-1">
                          {mapping.source === 'listing' ? (
                            <select value={mapping.listingField} onChange={(e) => updateMapping(key, { listingField: e.target.value })} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-300">
                              <option value="">-- Select Field --</option>
                              {LISTING_SOURCE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          ) : mapping.source === 'custom' ? (
                            <input type="text" value={mapping.defaultValue || ''} onChange={(e) => updateMapping(key, { defaultValue: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-indigo-400" placeholder="Enter value..." />
                          ) : (
                            <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase italic truncate">
                              {mapping.source === 'random' ? 'Random SKU/ID' : `Default Value: ${mapping.templateDefault || 'None'}`}
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
            <div className="flex-1 flex flex-col items-center justify-center opacity-20"><Layout size={64} className="mb-4" /><p className="font-black uppercase tracking-widest text-sm">Select a master template</p></div>
          )}
        </div>
      </div>
    </div>
  );
};
