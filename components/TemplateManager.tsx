
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
  { value: 'shipping', label: 'Shipping Cost' },
  { value: 'brand', label: 'Brand Name' },
  { value: 'description', label: 'Optimized Description' },
  { value: 'item_weight_value', label: 'Item Weight Value' },
  { value: 'item_weight_unit', label: 'Item Weight Unit' },
  { value: 'item_length', label: 'Item Length' },
  { value: 'item_width', label: 'Item Width' },
  { value: 'item_height', label: 'Item Height' },
  { value: 'item_size_unit', label: 'Item Size Unit' },
  { value: 'feature1', label: 'Bullet Point 1' },
  { value: 'feature2', label: 'Bullet Point 1' },
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

const TEMPLATE_SHEET_KEYWORDS = [
  'template', '模板', 'mall', 'vorlage', 'modèle', 'modelo', 
  'modello', 'plantilla', 'テンプレート', 'szablon', 'sjabloon', 'نموذج'
];

function safeEncode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const findAmazonTemplateSheet = (sheetNames: string[]): string => {
  const match = sheetNames.find(n => {
    const lower = n.toLowerCase();
    return TEMPLATE_SHEET_KEYWORDS.some(kw => lower === kw || lower.includes(kw));
  });
  if (match) return match;
  if (sheetNames.length >= 5) return sheetNames[4];
  if (sheetNames.length >= 2) return sheetNames[1];
  return sheetNames[0];
};

/**
 * 动态搜索表头行：在不同语言模板中，API 字段行位置可能不同
 */
const findHeaderRowIndex = (rows: any[][]): number => {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    const rowStr = row.map(c => String(c || '').toLowerCase()).join('|');
    // 亚马逊模板特征字段：通常包含 sku, item_name, feed_product_type 等
    if (
      rowStr.includes('sku') || 
      rowStr.includes('item_name') || 
      rowStr.includes('external_product_id') ||
      rowStr.includes('product_type')
    ) {
      return i;
    }
  }
  return 3; // 默认回退到 Row 4 (Index 3)
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
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellNF: true, cellText: true, cellStyles: true });
        const base64File = safeEncode(data);

        let foundHeaders: string[] = [];
        let rowDataDefaults: string[] = [];
        let fieldDefinitions: Record<string, string[]> = {};

        const vvSheet = workbook.SheetNames.find(n => 
          n.toLowerCase().includes('valid values') || 
          n.includes('有效值') || 
          n.toLowerCase().includes('valeurs') || 
          n.toLowerCase().includes('gültige') ||
          n.toLowerCase().includes('valores') // 增加对 MX/BR 站点的支持
        );

        if (vvSheet) {
          const rawData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[vvSheet], { header: 1 });
          let fCol = -1, vCol = -1;
          for (let i = 0; i < Math.min(rawData.length, 25); i++) {
            const row = rawData[i];
            const fIdx = row?.findIndex(c => String(c || '').toLowerCase().includes('field name') || String(c || '').includes('字段名称') || String(c || '').toLowerCase().includes('nombre del campo'));
            const vIdx = row?.findIndex(c => String(c || '').toLowerCase().includes('valid value') || String(c || '').includes('有效值') || String(c || '').toLowerCase().includes('valor'));
            if (fIdx !== -1 && vIdx !== -1) { fCol = fIdx; vCol = vIdx; break; }
          }
          if (fCol !== -1) {
            let lastF = "";
            rawData.forEach(row => {
              const f = String(row[fCol] || '').trim();
              const v = String(row[vCol] || '').trim();
              if (f && f.toLowerCase() !== 'field name' && f !== '字段名称' && !f.includes('nombre')) lastF = f;
              if (lastF && v && v.toLowerCase() !== 'valid value' && v !== '有效值' && v.toLowerCase() !== 'none' && !v.includes('valor')) {
                if (!fieldDefinitions[lastF]) fieldDefinitions[lastF] = [];
                if (!fieldDefinitions[lastF].includes(v)) fieldDefinitions[lastF].push(v);
              }
            });
          }
        }

        const finalTplName = findAmazonTemplateSheet(workbook.SheetNames);
        const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[finalTplName], { header: 1, defval: '' });
        
        // 核心修复：动态寻找表头行
        const headerRowIdx = findHeaderRowIndex(jsonData);
        const headerRow = jsonData[headerRowIdx];
        
        // 数据起始行：通常比亚马逊 API 字段行（表头行）低 4 行
        const dataRowIdx = headerRowIdx + 4;
        const dataRow = jsonData[dataRowIdx] || [];

        if (!headerRow || headerRow.length < 5) {
          throw new Error(uiLang === 'zh' ? "无法在工作表中找到有效的亚马逊表头字段，请确保文件未被损坏。" : "Could not identify template headers in the selected sheet.");
        }

        foundHeaders = headerRow.map(h => String(h || '').trim());
        rowDataDefaults = headerRow.map((_, i) => String(dataRow?.[i] || '').trim());

        const mappings: Record<string, any> = {};
        let imgCount = 0, bulletCount = 0;

        foundHeaders.forEach((h, i) => {
          if (!h) return;
          const lowerH = h.toLowerCase();
          const key = `col_${i}`;
          let source: any = rowDataDefaults[i] ? 'template_default' : 'custom';
          let field = '';

          // 增强匹配关键词
          if (lowerH.includes('sku') || lowerH.includes('external_product_id')) { source = 'listing'; field = 'asin'; }
          else if (lowerH.includes('item_name') || lowerH === 'title' || lowerH.includes('product_name') || lowerH.includes('nombre_del_producto')) { source = 'listing'; field = 'title'; }
          else if (lowerH.match(/image_url|image_location|附图|ubicación_de_la_imagen/)) { 
            imgCount++;
            source = 'listing'; 
            field = `other_image${imgCount}`; 
          }
          else if (lowerH.match(/bullet_point|商品要点|puntos_clave/)) {
            bulletCount++;
            source = 'listing';
            field = `feature${bulletCount}`;
          }

          mappings[key] = {
            header: h,
            source,
            listingField: field,
            defaultValue: rowDataDefaults[i],
            templateDefault: rowDataDefaults[i],
            acceptedValues: fieldDefinitions[h] || []
          };
        });

        mappings['__binary'] = base64File;
        // 记录表头所在行，以便导出时精准定位
        mappings['__header_row_idx'] = headerRowIdx;

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
          alert(uiLang === 'zh' ? "模板上传并解析成功！" : "Template uploaded successfully!");
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        alert(uiLang === 'zh' ? `上传失败: ${err.message}` : `Upload failed: ${err.message}`);
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
        marketplace: selectedTemplate.marketplace 
    }).eq('id', selectedTemplate.id);
    if (error) alert("Save failed: " + error.message);
    else alert(uiLang === 'zh' ? "保存成功！" : "Saved!");
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(tmp => tmp.name.toLowerCase().includes(templateSearchQuery.toLowerCase()));
  }, [templates, templateSearchQuery]);

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
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Macro-Enabled Engine • 18 Sites Support</p>
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
              <input type="text" placeholder={uiLang === 'zh' ? "搜索模板..." : "Search templates..."} value={templateSearchQuery} onChange={(e) => setTemplateSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none transition-all shadow-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {filteredTemplates.length === 0 ? (
              <div className="p-10 text-center opacity-20 flex flex-col items-center"><FileSpreadsheet size={32} className="mb-2" /><p className="text-[10px] font-black uppercase">No templates</p></div>
            ) : filteredTemplates.map(tmp => (
              <div key={tmp.id} onClick={() => setSelectedTemplate(tmp)} className={`group relative p-5 rounded-3xl border cursor-pointer transition-all ${selectedTemplate?.id === tmp.id ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500/10' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 overflow-hidden pr-2">
                    <p className="font-black text-xs truncate">{tmp.name}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Multi-Site Ready</p>
                  </div>
                  <button onClick={(e) => handleDeleteTemplate(e, tmp.id)} className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all transform hover:scale-110"><Trash2 size={14} /></button>
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
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Field Mappings & Rule Configuration</p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder={uiLang === 'zh' ? "搜索字段..." : "Search fields..."} value={fieldSearchQuery} onChange={(e) => setFieldSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                  </div>
                  <button onClick={saveMappings} className="px-8 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95">
                    <Save size={16} /> {t('save')}
                  </button>
                </div>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {filteredFields.length === 0 ? (
                  <div className="p-20 text-center opacity-20"><Layout size={48} className="mx-auto mb-4" /><p className="font-black uppercase tracking-widest text-xs">No matching fields</p></div>
                ) : filteredFields.map(({ header: h, index: i }) => {
                  const key = `col_${i}`;
                  const mapping = selectedTemplate.mappings?.[key] || { header: h, source: 'custom', defaultValue: '' };
                  const hasOptions = mapping.acceptedValues && mapping.acceptedValues.length > 0;
                  return (
                    <div key={key} className="p-6 rounded-[2rem] border bg-slate-50/30 border-slate-50 transition-all hover:border-indigo-100 group/field">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="space-y-1"><span className="text-[11px] font-black text-slate-600 break-all">{h}</span><p className="text-[8px] font-black text-slate-400 uppercase">Column Index: {i + 1}</p></div>
                        <select value={mapping.source} onChange={(e) => updateMapping(key, { source: e.target.value as any })} className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"><option value="custom">Manual Value</option><option value="template_default">Template Default</option><option value="listing">Listing Data</option><option value="random">🎲 Random Generate</option></select>
                        <div className="flex-1">
                          {mapping.source === 'listing' ? (
                            <select value={mapping.listingField} onChange={(e) => updateMapping(key, { listingField: e.target.value })} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black"><option value="">-- Choose Data --</option>{LISTING_SOURCE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
                          ) : (mapping.source === 'custom' && hasOptions) ? (
                            <select value={mapping.defaultValue || ''} onChange={(e) => updateMapping(key, { defaultValue: e.target.value })} className="w-full px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[11px] font-black"><option value="">-- Select Option --</option>{mapping.acceptedValues?.map((v, idx) => <option key={idx} value={v}>{v}</option>)}</select>
                          ) : mapping.source === 'custom' ? (
                            <input type="text" value={mapping.defaultValue || ''} onChange={(e) => updateMapping(key, { defaultValue: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" />
                          ) : (
                            <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase">{mapping.source === 'random' ? 'Smart AI Random' : `Default: ${mapping.templateDefault || 'None'}`}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20"><Layout size={64} className="mb-4" /><p className="font-black uppercase tracking-widest text-sm">Select a template from the list</p></div>
          )}
        </div>
      </div>
    </div>
  );
};
