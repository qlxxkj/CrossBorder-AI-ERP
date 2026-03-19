
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Trash2, Layout, Save, FileSpreadsheet, Loader2, Search, Globe, Tags, Sparkles, Plus, X } from 'lucide-react';
import { ExportTemplate, UILanguage, FieldMapping, Category } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { MARKETPLACES } from '../lib/marketplaces';
import * as XLSX from 'xlsx';

interface TemplateManagerProps {
  uiLang: UILanguage;
}

const LISTING_SOURCE_FIELDS = [
  { value: 'asin', label: 'ASIN / SKU' },
  { value: 'parent_asin', label: 'Parent ASIN / SKU' },
  { value: 'title', label: 'Title (Optimized or Cleaned)' },
  { value: 'price', label: 'Standard Price' },
  { value: 'shipping', label: 'Shipping Cost' },
  { value: 'currency', label: 'Currency Code' },
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
  { value: 'category', label: 'Category Path' },
  { value: 'search_keywords', label: 'Search Keywords' },
  { value: 'color', label: 'Color' },
  { value: 'size', label: 'Size' },
  { value: 'material', label: 'Material' },
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
    HIGH_CONFIDENCE_KEYWORDS.forEach(kw => { if (rowStr.includes(kw)) score += 100; });
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

const ZY_ERP_HEADERS = [
  '父SKU(必填)', 'SKU', '成人', '颜色', '尺码', '品牌', '分类', '中文简称', '英文简称', '库存', '币种', '成本价(必填)', '运费', '挂号模板', '海关编码', '申报价(美元)', '分销价', '毛重(克)', '包装尺寸', '适用人群', '材料', '包装材料', '金属', '珠宝', '语言', '标题(必填)', '关键字', '要点1', '要点2', '要点3', '要点4', '要点5', '简介', '产品图', '简介图', '参考网址', '安全等级', '产品级别'
];

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
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTemplateName, setManualTemplateName] = useState('');
  const [manualHeaders, setManualHeaders] = useState('');
  const [manualMarketplace, setManualMarketplace] = useState('ZY_ERP');

  const getAutoMapping = (h: string, imgCount: { val: number }, bulletCount: { val: number }) => {
    const humanField = h.toLowerCase();
    let source: any = 'custom', field = '';

    const isMatch = (regex: RegExp) => humanField.match(regex);

    if (isMatch(/sku/)) { 
      source = 'listing'; 
      field = humanField.includes('父') ? 'parent_asin' : 'asin'; 
    }
    else if (isMatch(/标题/)) { source = 'listing'; field = 'title'; }
    else if (isMatch(/产品图/)) { 
      imgCount.val++; 
      source = 'listing'; 
      field = imgCount.val === 1 ? 'main_image' : `other_image${imgCount.val - 1}`; 
    }
    else if (isMatch(/要点/)) { 
      bulletCount.val++; 
      source = 'listing'; 
      field = `feature${bulletCount.val}`; 
    }
    else if (isMatch(/成本价|分销价/)) { source = 'listing'; field = 'price'; }
    else if (isMatch(/简介/)) { source = 'listing'; field = 'description'; }
    else if (isMatch(/品牌/)) { source = 'listing'; field = 'brand'; }
    else if (isMatch(/关键字/)) { source = 'listing'; field = 'search_keywords'; }
    else if (isMatch(/毛重/)) { source = 'listing'; field = 'item_weight_value'; }
    else if (isMatch(/分类/)) { source = 'listing'; field = 'category'; }
    else if (isMatch(/运费/)) { source = 'listing'; field = 'shipping'; }
    else if (isMatch(/币种/)) { source = 'listing'; field = 'currency'; }
    else if (isMatch(/颜色/)) { source = 'listing'; field = 'color'; }
    else if (isMatch(/尺码/)) { source = 'listing'; field = 'size'; }
    else if (isMatch(/材料/)) { source = 'listing'; field = 'material'; }

    return { source, field };
  };

  const handleManualCreate = async () => {
    if (!manualTemplateName || !manualHeaders) {
      alert(uiLang === 'zh' ? "请填写模板名称和表头" : "Please fill in template name and headers");
      return;
    }

    const headers = manualHeaders.split(/[\t,\n]/).map(h => h.trim()).filter(h => h !== '');
    if (headers.length === 0) {
      alert(uiLang === 'zh' ? "表头不能为空" : "Headers cannot be empty");
      return;
    }

    setIsUploading(true);
    try {
      const mappings: Record<string, any> = {};
      const imgCount = { val: 0 };
      const bulletCount = { val: 0 };

      headers.forEach((h, i) => {
        const key = `col_${i}`;
        const { source, field } = getAutoMapping(h, imgCount, bulletCount);

        mappings[key] = { 
          header: h, 
          source, 
          listingField: field, 
          defaultValue: '',
          templateDefault: '',
          randomType: 'alphanumeric'
        };
      });

      // Manual templates don't have binary data or row indices
      mappings['__is_manual'] = true;
      mappings['__sheet_name'] = 'Sheet1';
      mappings['__data_start_row_idx'] = 1; // Data starts at row 2 (index 1) for manual templates

      const { data: { session } } = await supabase.auth.getSession();
      const { data: inserted, error: insertError } = await supabase.from('templates').insert([{
        user_id: session?.user?.id,
        name: manualTemplateName,
        headers: headers,
        mappings: mappings,
        marketplace: manualMarketplace,
        category_id: null,
        created_at: new Date().toISOString()
      }]).select();

      if (insertError) throw insertError;
      if (inserted) {
        await fetchTemplates(inserted[0].id);
        setShowManualModal(false);
        setManualTemplateName('');
        setManualHeaders('');
      }
    } catch (err: any) {
      alert("Failed to create template: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const createPresetTemplate = async (type: 'ZY_ERP') => {
    if (!isSupabaseConfigured()) return;
    setIsUploading(true);
    try {
      const name = type === 'ZY_ERP' ? '智赢ERP标准模板' : 'Custom Template';
      const headers = type === 'ZY_ERP' ? ZY_ERP_HEADERS : [];
      const marketplace = type === 'ZY_ERP' ? 'ZY_ERP' : 'AMAZON_US';

      const mappings: Record<string, any> = {};
      const imgCount = { val: 0 };
      const bulletCount = { val: 0 };

      headers.forEach((h, i) => {
        const key = `col_${i}`;
        const { source, field } = getAutoMapping(h, imgCount, bulletCount);

        mappings[key] = { 
          header: h, 
          source, 
          listingField: field, 
          defaultValue: '',
          templateDefault: '',
          randomType: 'alphanumeric'
        };
      });

      // Manual templates don't have binary data or row indices
      mappings['__is_manual'] = true;
      mappings['__sheet_name'] = 'Sheet1';
      mappings['__data_start_row_idx'] = 1; // Data starts at row 2 (index 1) for manual templates

      const { data: { session } } = await supabase.auth.getSession();
      const { data: inserted, error: insertError } = await supabase.from('templates').insert([{
        user_id: session?.user?.id,
        name: name,
        headers: headers,
        mappings: mappings,
        marketplace: marketplace,
        category_id: null,
        created_at: new Date().toISOString()
      }]).select();

      if (insertError) throw insertError;
      if (inserted) await fetchTemplates(inserted[0].id);
    } catch (err: any) {
      alert("Failed to create preset: " + err.message);
    } finally {
      setIsUploading(true);
      setTimeout(() => setIsUploading(false), 500);
    }
  };

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
        const workbook = XLSX.read(bytes, { type: 'array' });
        const base64File = safeEncode(bytes);

        const sheetName = findAmazonTemplateSheet(workbook);
        const jsonData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, range: 0, defval: '' });
        
        const techRowIdx = findHeaderRowIndex(jsonData);
        const techRow = jsonData[techRowIdx] || [];
        const humanRowIdx = techRowIdx - 1 >= 0 ? techRowIdx - 1 : techRowIdx;
        const humanRow = jsonData[humanRowIdx] || [];
        
        // 核心修复：更严格的数据起始行探测
        // 逻辑：跳过技术行下方的行，如果探测到关键词 "example", "sample", "示例", "e.g." 则继续向下
        let dataStartRowIdx = techRowIdx + 1;
        let userDataRow: any[] = [];
        
        // 扫描范围扩大，不仅看非空，还要避开示例标记
        for (let r = techRowIdx + 1; r < Math.min(jsonData.length, techRowIdx + 15); r++) {
          const row = jsonData[r];
          if (!row) continue;
          
          const rowStr = row.map(c => String(c).toLowerCase()).join('|');
          const isExample = rowStr.includes('example') || rowStr.includes('sample') || rowStr.includes('示例') || rowStr.includes('e.g.');
          const isNotEmpty = row.some(cell => String(cell).trim() !== '');
          
          if (isNotEmpty && !isExample) {
            dataStartRowIdx = r;
            userDataRow = row;
            break;
          }
        }
        
        // 兜底逻辑：如果全都是示例或全空，美国站默认第7行（Index 6），其他站默认技术行+1
        if (userDataRow.length === 0) {
            dataStartRowIdx = uploadMarketplace === 'US' ? techRowIdx + 3 : techRowIdx + 1;
            userDataRow = jsonData[dataStartRowIdx] || [];
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
          const humanField = String(humanRow[i] || '').toLowerCase().trim();
          const key = `col_${i}`;
          const userDataVal = String(userDataRow[i] || '').trim();
          
          let source: any = 'custom', field = '';
          
          // 匹配逻辑：优先匹配技术字段，其次匹配人类可读字段（支持中文）
          const isMatch = (regex: RegExp) => apiField.match(regex) || humanField.match(regex);

          if (isMatch(/item_sku|sku|external_product_id|父sku/)) { 
            source = 'listing'; 
            field = humanField.includes('父') ? 'parent_asin' : 'asin'; 
          }
          else if (isMatch(/item_name|title|product_name|标题/)) { source = 'listing'; field = 'title'; }
          else if (isMatch(/image_url|image_location|main_image|main_image_url|产品图/)) { 
            imgCount++; 
            source = 'listing'; 
            field = imgCount === 1 ? 'main_image' : `other_image${imgCount - 1}`; 
          }
          else if (isMatch(/bullet_point|feature_index|bullet|要点/)) { 
            bulletCount++; 
            source = 'listing'; 
            field = `feature${bulletCount}`; 
          }
          else if (isMatch(/standard_price|price|成本价|分销价/)) { source = 'listing'; field = 'price'; }
          else if (isMatch(/product_description|description|简介/)) { source = 'listing'; field = 'description'; }
          else if (isMatch(/brand_name|brand|品牌/)) { source = 'listing'; field = 'brand'; }
          else if (isMatch(/keyword|关键字/)) { source = 'listing'; field = 'search_keywords'; }
          else if (isMatch(/weight|毛重/)) { source = 'listing'; field = 'item_weight_value'; }
          else if (isMatch(/category|分类/)) { source = 'listing'; field = 'category'; }
          else if (isMatch(/shipping|运费/)) { source = 'listing'; field = 'shipping'; }
          else if (isMatch(/币种/)) { source = 'listing'; field = 'currency'; }
          else if (isMatch(/颜色/)) { source = 'listing'; field = 'color'; }
          else if (isMatch(/尺码/)) { source = 'listing'; field = 'size'; }
          else if (isMatch(/材料/)) { source = 'listing'; field = 'material'; }
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

  const getFlag = (code: string) => MARKETPLACES.find(m => m.code === code)?.flag || '🌍';
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
              {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.code}</option>)}
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
          <button 
            onClick={() => setShowManualModal(true)} 
            disabled={isUploading} 
            className="px-6 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-xs flex items-center gap-3 shadow-sm hover:bg-slate-50 transition-all uppercase"
          >
            <Plus size={16} className="text-indigo-600" /> {uiLang === 'zh' ? '手动新增' : 'Manual Create'}
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all uppercase">
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {t('uploadTemplate')}
          </button>
          <button 
            onClick={() => createPresetTemplate('ZY_ERP')} 
            disabled={isUploading} 
            className="px-6 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xs flex items-center gap-3 shadow-sm hover:bg-slate-200 transition-all uppercase"
          >
            <Sparkles size={16} className="text-indigo-600" /> {uiLang === 'zh' ? '智赢ERP预设' : 'ZY ERP Preset'}
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
                       {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.code}</option>)}
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

      {showManualModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {uiLang === 'zh' ? '手动新增导出模板' : 'Create Manual Template'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Custom Header Calibration</p>
                </div>
              </div>
              <button onClick={() => setShowManualModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {uiLang === 'zh' ? '快速预设' : 'Quick Presets'}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button 
                    type="button"
                    onClick={() => createPresetTemplate('ZY_ERP').then(() => { setShowManualModal(false); fetchTemplates(); })}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                  >
                    Zhiying ERP (智赢)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-100"></div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Or Create Custom</span>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {uiLang === 'zh' ? '模板名称' : 'Template Name'}
                </label>
                <input 
                  type="text" 
                  value={manualTemplateName}
                  onChange={(e) => setManualTemplateName(e.target.value)}
                  placeholder={uiLang === 'zh' ? "例如：智赢ERP自定义模板" : "e.g. ZY ERP Custom"}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {uiLang === 'zh' ? '所属平台' : 'Platform'}
                </label>
                <select 
                  value={manualMarketplace}
                  onChange={(e) => setManualMarketplace(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none"
                >
                  {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {uiLang === 'zh' ? '自定义表头 (用逗号或制表符分隔)' : 'Custom Headers (Comma or Tab separated)'}
                </label>
                <textarea 
                  value={manualHeaders}
                  onChange={(e) => setManualHeaders(e.target.value)}
                  placeholder={uiLang === 'zh' ? "父SKU, SKU, 标题, 成本价..." : "Parent SKU, SKU, Title, Price..."}
                  rows={5}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none custom-scrollbar"
                />
                <p className="text-[9px] font-bold text-slate-400 italic ml-1">
                  {uiLang === 'zh' ? '提示：您可以直接从 Excel 复制表头并粘贴到此处。' : 'Tip: You can copy headers directly from Excel and paste them here.'}
                </p>
              </div>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex items-center justify-end gap-4">
              <button 
                onClick={() => setShowManualModal(false)}
                className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                {uiLang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button 
                onClick={handleManualCreate}
                disabled={isUploading}
                className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {uiLang === 'zh' ? '创建并配置' : 'Create & Configure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
