
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Plus, Trash2, Layout, Settings2, Save, FileSpreadsheet, Loader2, Check, AlertCircle, Info, Star, Filter, ArrowRightLeft, Database, Copy, Shuffle, ChevronDown, RefreshCcw, Tag, ListFilter, Search, Globe, X, DatabaseZap, Tags, Sparkles } from 'lucide-react';
import { ExportTemplate, UILanguage, FieldMapping, Category } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';
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
  'item_sku', 'external_product_id', 'feed_product_type', 'item_name', 
  'brand_name', 'standard_price', 'main_image_url', 'product_description',
  'bullet_point1', 'quantity', 'update_delete', 'product_id_type'
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
    
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
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
  let bestIdx = 0;
  let maxScore = -1;

  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue; 
    
    let score = 0;
    const rowStr = row.map(c => String(c || '').toLowerCase()).join('|');
    
    HIGH_CONFIDENCE_KEYWORDS.forEach(kw => { 
      if (rowStr.includes(kw)) score += 100;
    });

    row.forEach(cell => {
      const s = String(cell || '').trim();
      if (s.includes('_') && s.toLowerCase() === s && s.length > 3) score += 10;
    });

    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }
  return maxScore > 50 ? bestIdx : 2; 
};

export const TemplateManager: React.FC<TemplateManagerProps> = ({ uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [uploadMarketplace, setUploadMarketplace] = useState('US');
  const [uploadCategory, setUploadCategory] = useState('ALL');

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*');
    if (data) setCategories(data);
  };

  const fetchTemplates = async (selectId?: string) => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) {
      setTemplates(data);
      if (selectId) {
        const found = data.find(t => t.id === selectId);
        if (found) setSelectedTemplate(found);
      } else if (!selectedTemplate && data.length > 0) {
        setSelectedTemplate(data[0]);
      }
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm(uiLang === 'zh' ? "确定要删除该模板吗？" : "Are you sure?")) return;
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
    }
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
        const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, range: 0, defval: '' });
        
        const techRowIdx = findHeaderRowIndex(jsonData);
        const techRow = jsonData[techRowIdx] || [];
        const humanRowIdx = techRowIdx - 1 >= 0 ? techRowIdx - 1 : techRowIdx;
        const humanRow = jsonData[humanRowIdx] || [];
        
        // Scan for the first data row that has actual content after the headers
        let dataStartRowIdx = techRowIdx + 1;
        let userDataRow: any[] = [];
        for (let r = techRowIdx + 1; r < Math.min(jsonData.length, techRowIdx + 10); r++) {
          const row = jsonData[r];
          if (row && row.some(cell => String(cell).trim() !== '')) {
            dataStartRowIdx = r;
            userDataRow = row;
            break;
          }
        }

        const maxCols = Math.max(techRow.length, humanRow.length);
        const foundHeaders: string[] = [];
        for (let i = 0; i < maxCols; i++) {
          const display = String(humanRow[i] || '').trim();
          const tech = String(techRow[i] || '').trim();
          foundHeaders.push(display || tech || `Column ${i + 1}`);
        }

        const mappings: Record<string, any> = {};
        let imgCount = 0, bulletCount = 0;

        foundHeaders.forEach((h, i) => {
          const apiField = String(techRow[i] || '').toLowerCase().trim();
          const key = `col_${i}`;
          const userDataVal = String(userDataRow[i] || '').trim();
          
          let source: any = 'custom', field = '';
          
          if (apiField.match(/item_sku|sku|external_product_id/)) { source = 'listing'; field = 'asin'; }
          else if (apiField.match(/item_name|title|product_name/)) { source = 'listing'; field = 'title'; }
          else if (apiField.match(/image_url|image_location|main_image|main_image_url/)) { 
            imgCount++; 
            source = 'listing'; 
            field = imgCount === 1 ? 'main_image' : `other_image${imgCount - 1}`; 
          }
          else if (apiField.match(/bullet_point|feature_index|bullet/)) { 
            bulletCount++; 
            source = 'listing'; 
            field = `feature${bulletCount}`; 
          }
          else if (apiField.match(/standard_price|price/)) { source = 'listing'; field = 'price'; }
          else if (apiField.match(/product_description|description/)) { source = 'listing'; field = 'description'; }
          else if (apiField.match(/brand_name|brand/)) { source = 'listing'; field = 'brand'; }
          else {
            if (userDataVal) {
              source = 'template_default';
            } else {
              source = 'custom';
            }
          }

          mappings[key] = { 
            header: h, 
            source, 
            listingField: field, 
            defaultValue: userDataVal,
            templateDefault: userDataVal,
            randomType: 'alphanumeric'
          };
        });

        mappings['__binary'] = base64File;
        mappings['__header_row_idx'] = techRowIdx;
        mappings['__display_header_row_idx'] = humanRowIdx;
        mappings['__data_start_row_idx'] = dataStartRowIdx;
        mappings['__sheet_name'] = sheetName;

        const { data: { session } } = await supabase.auth.getSession();
        const { data: inserted, error: insertError } = await supabase.from('templates').insert([{
          user_id: session?.user?.id,
          name: file.name,
          headers: foundHeaders,
          mappings: mappings,
          marketplace: uploadMarketplace,
          category_id: uploadCategory === 'ALL' ? null : uploadCategory,
          created_at: new Date().toISOString()
        }]).select();

        if (insertError) throw insertError;
        if (inserted) await fetchTemplates(inserted[0].id);
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
      mappings: selectedTemplate.mappings, 
      marketplace: selectedTemplate.marketplace,
      category_id: selectedTemplate.category_id 
    }).eq('id', selectedTemplate.id);
    if (!error) alert(uiLang === 'zh' ? "配置已保存！" : "Saved!");
  };

  const filteredFields = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.headers.map((h, i) => ({ header: h, index: i }))
      .filter(item => item.header && item.header.toLowerCase().includes(fieldSearchQuery.toLowerCase()));
  }, [selectedTemplate, fieldSearchQuery]);

  const getFlag = (code: string) => AMAZON_MARKETPLACES.find(m => m.code === code)?.flag || '🌍';
  const getCategoryName = (id?: string) => categories.find(c => c.id === id)?.name || 'Default';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-inter pb-20">
      <div className="flex flex-col xl:flex-row items-center justify-between bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl"><FileSpreadsheet size={28} /></div>
          <div><h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('templateManager')}</h2><p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Global Calibration Engine</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={uploadMarketplace} 
              onChange={(e) => setUploadMarketplace(e.target.value)}
              className="pl-12 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest appearance-none outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            >
              {AMAZON_MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.code}</option>)}
            </select>
          </div>
          <div className="relative">
            <Tags className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={uploadCategory} 
              onChange={(e) => setUploadCategory(e.target.value)}
              className="pl-12 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest appearance-none outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            >
              <option value="ALL">Global Cat</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all uppercase">
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {t('uploadTemplate')}
          </button>
        </div>
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
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      <span>{getFlag(tmp.marketplace)} {tmp.marketplace}</span>
                      <span className="opacity-30">|</span>
                      <span>{getCategoryName(tmp.category_id)}</span>
                    </div>
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
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                     <select 
                      value={selectedTemplate.marketplace} 
                      onChange={(e) => setSelectedTemplate({...selectedTemplate, marketplace: e.target.value})}
                      className="bg-slate-900 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest outline-none cursor-pointer"
                     >
                       {AMAZON_MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.code}</option>)}
                     </select>
                     <select 
                      value={selectedTemplate.category_id || 'ALL'} 
                      onChange={(e) => setSelectedTemplate({...selectedTemplate, category_id: e.target.value === 'ALL' ? undefined : e.target.value})}
                      className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest outline-none cursor-pointer"
                     >
                       <option value="ALL">GLOBAL CAT</option>
                       {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder={uiLang === 'zh' ? "搜索字段..." : "Search..."} value={fieldSearchQuery} onChange={(e) => setFieldSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                  </div>
                  <button onClick={saveMappings} className="px-8 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all"><Save size={16} /> {t('save')}</button>
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
                          <p className="text-[8px] font-black text-slate-400 uppercase">Template Value: {selectedTemplate.mappings?.[`col_${i}`]?.templateDefault || '-'}</p>
                        </div>
                        <select value={mapping.source} onChange={(e) => updateMapping(key, { source: e.target.value as any })} className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold cursor-pointer">
                          <option value="custom">Manual Value</option>
                          <option value="listing">Listing Data</option>
                          <option value="random">Random Generator</option>
                          <option value="template_default">Template Default</option>
                        </select>
                        <div className="flex-1">
                          {mapping.source === 'listing' ? (
                            <select value={mapping.listingField} onChange={(e) => updateMapping(key, { listingField: e.target.value })} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black">
                              <option value="">-- Select Field --</option>
                              {LISTING_SOURCE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          ) : mapping.source === 'random' ? (
                             <div className="flex items-center gap-2 bg-purple-50 p-1.5 rounded-xl border border-purple-100">
                                <Sparkles className="text-purple-500 shrink-0" size={14} />
                                <select 
                                  value={mapping.randomType || 'alphanumeric'} 
                                  onChange={(e) => updateMapping(key, { randomType: e.target.value as any })}
                                  className="w-full bg-transparent text-[11px] font-black text-purple-700 outline-none"
                                >
                                  <option value="alphanumeric">3 Letters + 4 Digits</option>
                                  <option value="ean13">EAN-13 Code</option>
                                </select>
                             </div>
                          ) : mapping.source === 'custom' ? (
                            <input type="text" value={mapping.defaultValue || ''} onChange={(e) => updateMapping(key, { defaultValue: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold" placeholder="Enter value..." />
                          ) : (
                            <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase italic truncate">{mapping.templateDefault || 'None'}</div>
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
