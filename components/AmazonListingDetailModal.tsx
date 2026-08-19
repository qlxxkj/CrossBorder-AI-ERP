import React, { useState } from 'react';
import { 
  X, Save, Zap, AlertTriangle, Trash2, Plus, Check, 
  ExternalLink, Layers, DollarSign, FileText, Search, Image as ImageIcon,
  ShieldCheck, Info, Sparkles, RefreshCw, CheckCircle2, ChevronRight
} from 'lucide-react';
import { AmazonProduct, UILanguage } from '../types';
import { publishListingToSpApiProxy, getStoredSpApiConfig } from '../services/spApiService';

interface AmazonListingDetailModalProps {
  product: AmazonProduct;
  uiLang: UILanguage;
  onClose: () => void;
  onSave: (updatedProduct: AmazonProduct) => void;
  onDelete: (productId: string) => void;
}

type TabType = 'vital' | 'variation' | 'offer' | 'description' | 'keywords' | 'images';

export const AmazonListingDetailModal: React.FC<AmazonListingDetailModalProps> = ({
  product,
  uiLang,
  onClose,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<AmazonProduct>({
    ...product,
    bullet_points: product.bullet_points && product.bullet_points.length > 0 
      ? [...product.bullet_points] 
      : ['', '', ''],
    other_images: product.other_images ? [...product.other_images] : []
  });

  const [activeTab, setActiveTab] = useState<TabType>('vital');
  const [isPushing, setIsPushing] = useState(false);
  const [pushResultNotice, setPushResultNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isZh = uiLang === 'zh';

  const handleFieldChange = (field: keyof AmazonProduct, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBulletPointChange = (index: number, value: string) => {
    const updated = [...(formData.bullet_points || [])];
    updated[index] = value;
    setFormData(prev => ({ ...prev, bullet_points: updated }));
  };

  const handleAddBulletPoint = () => {
    setFormData(prev => ({
      ...prev,
      bullet_points: [...(prev.bullet_points || []), '']
    }));
  };

  const handleRemoveBulletPoint = (index: number) => {
    const updated = (formData.bullet_points || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, bullet_points: updated }));
  };

  const handleAddOtherImage = () => {
    setFormData(prev => ({
      ...prev,
      other_images: [...(prev.other_images || []), '']
    }));
  };

  const handleOtherImageChange = (index: number, value: string) => {
    const updated = [...(formData.other_images || [])];
    updated[index] = value;
    setFormData(prev => ({ ...prev, other_images: updated }));
  };

  const handleRemoveOtherImage = (index: number) => {
    const updated = (formData.other_images || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, other_images: updated }));
  };

  // Push to SP-API directly
  const handlePushToAmazon = async () => {
    setIsPushing(true);
    setPushResultNotice(null);
    try {
      const config = getStoredSpApiConfig();
      const res = await publishListingToSpApiProxy(config, {
        sku: formData.sku,
        asin: formData.asin,
        title: formData.title,
        brand: formData.brand,
        price: formData.price,
        quantity: formData.quantity,
        fulfillment_channel: formData.fulfillment_channel === 'FBA' ? 'FBA' : 'FBM',
        bullet_points: formData.bullet_points?.filter(b => b.trim().length > 0),
        description: formData.description
      });

      const updated = {
        ...formData,
        feed_submission_id: res.submission_id,
        submission_status: res.status as any,
        last_synced_at: new Date().toISOString()
      };

      setFormData(updated);
      onSave(updated);
      setPushResultNotice({
        success: true,
        message: isZh 
          ? `SP-API 提交成功！批次ID: ${res.submission_id || 'ACCEPTED'}。商品属性已同步并记录至上传日志。` 
          : `SP-API Push Successful! Submission ID: ${res.submission_id || 'ACCEPTED'}`
      });
    } catch (err: any) {
      setPushResultNotice({
        success: false,
        message: err.message || (isZh ? '推送失败，请检查 SP-API 凭证与网络' : 'Push failed')
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleSaveLocal = () => {
    onSave(formData);
    onClose();
  };

  // Search terms byte calculator (Amazon limit: 250 bytes)
  const searchTermsBytes = new TextEncoder().encode(formData.search_terms || '').length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header (Amazon Seller Central Style) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider">
              AMZ Listing
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  {isZh ? '编辑亚马逊商品详情' : 'Edit Amazon Listing Attributes'}
                </h2>
                <span className="font-mono text-xs bg-slate-800 text-amber-400 px-2 py-0.5 rounded border border-slate-700">
                  SKU: {formData.sku}
                </span>
                {formData.asin && (
                  <span className="font-mono text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    ASIN: {formData.asin}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isZh ? '按照亚马逊后台规范编辑基础属性、变体关系、报价、五点描述与图片' : 'Edit vital info, variation attributes, pricing & offer, bullet points'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {formData.asin && (
              <a 
                href={`https://www.amazon.com/dp/${formData.asin}`} 
                target="_blank" 
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                {isZh ? '在亚马逊查看' : 'View on Amazon'} <ExternalLink size={12} />
              </a>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status Notice */}
        {pushResultNotice && (
          <div className={`px-6 py-3 text-xs font-bold flex items-center justify-between border-b ${
            pushResultNotice.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {pushResultNotice.success ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-red-600" />}
              <span>{pushResultNotice.message}</span>
            </div>
            <button onClick={() => setPushResultNotice(null)} className="text-slate-500 hover:text-slate-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Navigation (Tabs like Amazon Seller Central) */}
        <div className="flex items-center gap-1 px-6 bg-slate-50 border-b border-slate-200 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('vital')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'vital' 
                ? 'border-amber-500 text-amber-700 bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Info size={14} />
            {isZh ? '1. 重要信息 (Vital Info)' : '1. Vital Info'}
          </button>

          <button
            onClick={() => setActiveTab('variation')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'variation' 
                ? 'border-amber-500 text-amber-700 bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            {isZh ? '2. 变体关系 (Variations)' : '2. Variations'}
          </button>

          <button
            onClick={() => setActiveTab('offer')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'offer' 
                ? 'border-amber-500 text-amber-700 bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign size={14} />
            {isZh ? '3. 报价与库存 (Offer)' : '3. Offer & Stock'}
          </button>

          <button
            onClick={() => setActiveTab('description')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'description' 
                ? 'border-amber-500 text-amber-700 bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} />
            {isZh ? '4. 描述与五点 (Description)' : '4. Description'}
          </button>

          <button
            onClick={() => setActiveTab('keywords')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'keywords' 
                ? 'border-amber-500 text-amber-700 bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search size={14} />
            {isZh ? '5. 搜索词与属性 (Keywords)' : '5. Keywords'}
          </button>

          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'images' 
                ? 'border-amber-500 text-amber-700 bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon size={14} />
            {isZh ? '6. 图片管理 (Images)' : '6. Images'}
          </button>
        </div>

        {/* Tab Body Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
          {/* TAB 1: VITAL INFO */}
          {activeTab === 'vital' && (
            <div className="space-y-5 max-w-3xl">
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100 text-amber-900 flex items-start gap-3">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-xs">{isZh ? '基础重要信息规范' : 'Vital Info Guidelines'}</h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {isZh 
                      ? '商品标题建议简洁明确并控制在 75 字符内。请准确填写品牌和型号以提高亚马逊收录与搜索权重。' 
                      : 'Provide accurate title, brand, and identifiers for Amazon catalog indexing.'}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800">
                    {isZh ? '商品标题 (Item Name / Title)' : 'Product Title'} <span className="text-red-500">*</span>
                  </label>
                  <span className={`font-mono text-[10px] font-bold ${
                    formData.title.length > 75 ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {formData.title.length} / 75 {isZh ? '字符 (推荐长度)' : 'chars'}
                  </span>
                </div>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder={isZh ? "请输入商品标题..." : "Enter product title..."}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '卖家 SKU (Merchant SKU)' : 'Seller SKU'} <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.sku}
                    onChange={(e) => handleFieldChange('sku', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '亚马逊 ASIN' : 'Amazon ASIN'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.asin}
                    onChange={(e) => handleFieldChange('asin', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '品牌名称 (Brand Name)' : 'Brand Name'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.brand || ''}
                    onChange={(e) => handleFieldChange('brand', e.target.value)}
                    placeholder="e.g. SoundCore"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '制造商 (Manufacturer)' : 'Manufacturer'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.manufacturer || ''}
                    onChange={(e) => handleFieldChange('manufacturer', e.target.value)}
                    placeholder="e.g. SoundCore Technology Co."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '型号 / 部件号 (Model / Part #)' : 'Model / Part Number'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.model_number || ''}
                    onChange={(e) => handleFieldChange('model_number', e.target.value)}
                    placeholder="e.g. V2-PRO-BLK"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '原产国 / 地区 (Country of Origin)' : 'Country of Origin'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.country_of_origin || ''}
                    onChange={(e) => handleFieldChange('country_of_origin', e.target.value)}
                    placeholder="e.g. China (CN)"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '目标站点 (Marketplace)' : 'Marketplace'}
                  </label>
                  <select 
                    value={formData.marketplace}
                    onChange={(e) => handleFieldChange('marketplace', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  >
                    <option value="US">{isZh ? '美国' : 'United States'}</option>
                    <option value="CA">{isZh ? '加拿大' : 'Canada'}</option>
                    <option value="MX">{isZh ? '墨西哥' : 'Mexico'}</option>
                    <option value="UK">{isZh ? '英国' : 'United Kingdom'}</option>
                    <option value="DE">{isZh ? '德国' : 'Germany'}</option>
                    <option value="FR">{isZh ? '法国' : 'France'}</option>
                    <option value="IT">{isZh ? '意大利' : 'Italy'}</option>
                    <option value="ES">{isZh ? '西班牙' : 'Spain'}</option>
                    <option value="JP">{isZh ? '日本' : 'Japan'}</option>
                    <option value="AU">{isZh ? '澳大利亚' : 'Australia'}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VARIATIONS */}
          {activeTab === 'variation' && (
            <div className="space-y-5 max-w-3xl">
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-indigo-900 flex items-start gap-3">
                <Layers size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-xs">{isZh ? '父子变体关系设置' : 'Parent-Child Variation Hierarchy'}</h4>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    {isZh 
                      ? '在下方指定该商品所属的父体 Parent ASIN / SKU 与变体属性（如颜色、尺码），系统将自动将其归纳在父子折叠树状视图中。' 
                      : 'Group this item under a parent ASIN or SKU with color/size variation attributes.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '父体 ASIN (Parent ASIN)' : 'Parent ASIN'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.parent_asin || ''}
                    onChange={(e) => handleFieldChange('parent_asin', e.target.value)}
                    placeholder="e.g. B09YOGA-PARENT-12"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold text-amber-700 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '父体 SKU (Parent SKU)' : 'Parent SKU'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.parent_sku || ''}
                    onChange={(e) => handleFieldChange('parent_sku', e.target.value)}
                    placeholder="e.g. YOGA-SEAMLESS-PARENT"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold text-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '变体主题 (Variation Theme)' : 'Variation Theme'}
                  </label>
                  <select 
                    value={formData.variation_theme || ''}
                    onChange={(e) => handleFieldChange('variation_theme', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:bg-white"
                  >
                    <option value="">{isZh ? '无变体 (Single Item)' : 'No Variations'}</option>
                    <option value="Color">Color (颜色)</option>
                    <option value="Size">Size (尺码/规格)</option>
                    <option value="Color-Size">Color-Size (颜色与尺码)</option>
                    <option value="Style">Style (款式/风格)</option>
                    <option value="ItemPackageQuantity">ItemPackageQuantity (包装件数)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '变体显示名称 / 标签' : 'Variation Display Label'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.variation_name || ''}
                    onChange={(e) => handleFieldChange('variation_name', e.target.value)}
                    placeholder="e.g. Color: Midnight Black, Size: M"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '颜色名称 (Color Name)' : 'Color Name'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.color_name || ''}
                    onChange={(e) => handleFieldChange('color_name', e.target.value)}
                    placeholder="e.g. Midnight Black"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '尺码名称 (Size Name)' : 'Size Name'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.size_name || ''}
                    onChange={(e) => handleFieldChange('size_name', e.target.value)}
                    placeholder="e.g. Medium (M)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '材质 (Material)' : 'Material'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.material || ''}
                    onChange={(e) => handleFieldChange('material', e.target.value)}
                    placeholder="e.g. 75% Nylon, 25% Spandex"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '风格/款式 (Style)' : 'Style'}
                  </label>
                  <input 
                    type="text" 
                    value={formData.style || ''}
                    onChange={(e) => handleFieldChange('style', e.target.value)}
                    placeholder="e.g. High-Waist Athletic"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OFFER & STOCK */}
          {activeTab === 'offer' && (
            <div className="space-y-5 max-w-3xl">
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-emerald-900 flex items-start gap-3">
                <DollarSign size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-xs">{isZh ? '报价、库存与配送方式' : 'Pricing, Inventory & Fulfillment'}</h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    {isZh 
                      ? '配置标准售价、可售数量、配送渠道（FBA 亚马逊配送或 FBM 自发货）及商品销售状态。' 
                      : 'Configure price, quantity, fulfillment channel, and active status.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '销售价格 (Your Price)' : 'Your Price'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      {formData.currency === 'EUR' ? '€' : formData.currency === 'GBP' ? '£' : '$'}
                    </span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => handleFieldChange('price', parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '参考标价 (List Price / MSRP)' : 'List Price / MSRP'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      {formData.currency === 'EUR' ? '€' : formData.currency === 'GBP' ? '£' : '$'}
                    </span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={formData.list_price || ''}
                      onChange={(e) => handleFieldChange('list_price', parseFloat(e.target.value) || undefined)}
                      placeholder="e.g. 39.99"
                      className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '结算币种 (Currency)' : 'Currency'}
                  </label>
                  <select 
                    value={formData.currency}
                    onChange={(e) => handleFieldChange('currency', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  >
                    <option value="USD">USD ($ - 美元)</option>
                    <option value="CAD">CAD (CA$ - 加元)</option>
                    <option value="EUR">EUR (€ - 欧元)</option>
                    <option value="GBP">GBP (£ - 英镑)</option>
                    <option value="JPY">JPY (¥ - 日元)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '可售库存数量 (Quantity)' : 'Quantity / Stock'} <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    value={formData.quantity}
                    onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 0)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-base text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? '配送模式 (Fulfillment Channel)' : 'Fulfillment Channel'}
                  </label>
                  <select 
                    value={formData.fulfillment_channel}
                    onChange={(e) => handleFieldChange('fulfillment_channel', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  >
                    <option value="FBA">FBA (亚马逊配送 - AMAZON_NA / AMAZON_EU)</option>
                    <option value="FBM">FBM (卖家自发货 - DEFAULT)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">
                    {isZh ? 'Listing 在线状态 (Status)' : 'Status'}
                  </label>
                  <select 
                    value={formData.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white"
                  >
                    <option value="Active">Active (在售在线 - BUYABLE)</option>
                    <option value="Draft">Draft (草稿 / 待同步)</option>
                    <option value="Inactive">Inactive (下架停售 - INACTIVE)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '商品成色 (Item Condition)' : 'Condition'}
                  </label>
                  <select 
                    value={formData.condition || 'New'}
                    onChange={(e) => handleFieldChange('condition', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="New">New (全新)</option>
                    <option value="Renewed">Renewed (翻新)</option>
                    <option value="UsedLikeNew">Used - Like New (二手 - 99新)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '发货准备时间 (Handling Time)' : 'Handling Time (Days)'}
                  </label>
                  <input 
                    type="number" 
                    value={formData.handling_time || 2}
                    onChange={(e) => handleFieldChange('handling_time', parseInt(e.target.value) || 2)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '单笔最大订购量 (Max Order Qty)' : 'Max Order Quantity'}
                  </label>
                  <input 
                    type="number" 
                    value={formData.max_order_quantity || 10}
                    onChange={(e) => handleFieldChange('max_order_quantity', parseInt(e.target.value) || 10)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BULLET POINTS & DESCRIPTION */}
          {activeTab === 'description' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      {isZh ? '五点描述 (Key Product Features / Bullet Points)' : 'Key Product Features'}
                    </label>
                    <p className="text-[11px] text-slate-400">
                      {isZh ? '亚马逊商品详情页顶部的核心卖点列表（支持 1-5 点，建议每条首词大写）' : 'Top bullet points on Amazon product page'}
                    </p>
                  </div>
                  <button
                    onClick={handleAddBulletPoint}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-black text-xs transition-all flex items-center gap-1"
                  >
                    <Plus size={13} /> {isZh ? '添加要点' : 'Add Point'}
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.bullet_points || []).map((bp, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] flex items-center justify-center shrink-0 mt-2">
                        {idx + 1}
                      </span>
                      <textarea
                        value={bp}
                        onChange={(e) => handleBulletPointChange(idx, e.target.value)}
                        placeholder={`Bullet Point #${idx + 1} (e.g. BUTTERY SOFT: 4-way stretch...)`}
                        rows={2}
                        className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                      <button
                        onClick={() => handleRemoveBulletPoint(idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all mt-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="font-black text-slate-900 text-xs block mb-1.5">
                  {isZh ? '商品详细描述 (Product Description - HTML / 纯文本)' : 'Product Description'}
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={6}
                  placeholder={isZh ? "<p>请输入完整的商品详情介绍，支持标准 HTML 格式段落...</p>" : "<p>Enter rich product description...</p>"}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: KEYWORDS */}
          {activeTab === 'keywords' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800">
                    {isZh ? '搜索关键词 (Generic Search Terms)' : 'Generic Search Terms'}
                  </label>
                  <span className={`font-mono text-[10px] font-bold ${
                    searchTermsBytes > 250 ? 'text-red-500' : 'text-emerald-600'
                  }`}>
                    {searchTermsBytes} / 250 {isZh ? '字节 (Amazon 上限 250 字节)' : 'bytes'}
                  </span>
                </div>
                <textarea 
                  value={formData.search_terms || ''}
                  onChange={(e) => handleFieldChange('search_terms', e.target.value)}
                  rows={3}
                  placeholder="yoga pants high waist compression leggings workout running tights pocket athletic buttery soft non see through..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {isZh ? '提示：用空格分隔各个词汇，不要包含标点符号、品牌名或重复词汇以确保符合亚马逊搜索政策。' : 'Separate keywords by spaces without punctuation or brand names.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '目标受众 (Target Audience)' : 'Target Audience'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="Women, Athletes, Yoga Practitioners"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isZh ? '保修与售后条款 (Warranty Description)' : 'Warranty'}
                  </label>
                  <input 
                    type="text" 
                    placeholder="30-day money back & 1-year manufacturer warranty"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: IMAGES */}
          {activeTab === 'images' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <label className="font-black text-slate-900 text-xs block mb-1.5">
                  {isZh ? '商品主图链接 (Main Product Image URL)' : 'Main Image URL'} <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                    {formData.main_image ? (
                      <img src={formData.main_image} alt="Main" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon size={28} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input 
                      type="text" 
                      value={formData.main_image || ''}
                      onChange={(e) => handleFieldChange('main_image', e.target.value)}
                      placeholder="https://images.unsplash.com/... or Amazon S3 URL"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white"
                    />
                    <p className="text-[10px] text-slate-400">
                      {isZh ? '主图要求：纯白背景（RGB 255,255,255），商品主体占据画面 85% 以上，长边建议 >= 1600 像素以支持缩放。' : 'Main image must have pure white background and be >= 1600px for zoom.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="font-black text-slate-900 text-xs">
                      {isZh ? '附图 / 变体效果图 (Other Product Images 1-8)' : 'Other Product Images'}
                    </label>
                    <p className="text-[11px] text-slate-400">
                      {isZh ? '展示不同角度、尺寸对照、使用场景与细节图' : 'Additional angles and lifestyle photos'}
                    </p>
                  </div>
                  <button
                    onClick={handleAddOtherImage}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center gap-1"
                  >
                    <Plus size={13} /> {isZh ? '添加附图' : 'Add Image'}
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.other_images || []).map((imgUrl, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                      <div className="w-12 h-12 bg-white rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                        {imgUrl ? (
                          <img src={imgUrl} alt={`Other ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon size={18} className="text-slate-300" />
                        )}
                      </div>
                      <input 
                        type="text" 
                        value={imgUrl}
                        onChange={(e) => handleOtherImageChange(idx, e.target.value)}
                        placeholder={`https://... Image #${idx + 1}`}
                        className="flex-1 p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs"
                      />
                      <button
                        onClick={() => handleRemoveOtherImage(idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              {isZh ? '从本地列表移除' : 'Remove from ERP'}
            </button>
            <span className="text-[10px] text-slate-400 hidden md:inline">
              ({isZh ? '仅清除本系统缓存，不影响亚马逊后台' : 'Local cache only'})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all"
            >
              {isZh ? '取消' : 'Cancel'}
            </button>

            <button
              onClick={handleSaveLocal}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <Save size={14} />
              {isZh ? '保存到本地' : 'Save Locally'}
            </button>

            <button
              onClick={handlePushToAmazon}
              disabled={isPushing}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black text-xs shadow-lg shadow-amber-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap size={14} className={isPushing ? 'animate-bounce' : ''} />
              {isPushing ? (isZh ? '正在推送至 SP-API...' : 'Pushing...') : (isZh ? '保存并通过 SP-API 推送至亚马逊' : 'Save & Push to Amazon')}
            </button>
          </div>
        </div>
      </div>

      {/* Clear/Delete Safety Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/70 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {isZh ? '确认从本地列表移除？' : 'Remove from Local Cache?'}
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  SKU: {formData.sku}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
              <p className="font-bold text-slate-800">
                {isZh ? '🛡️ 安全机制说明：' : 'Safety Info:'}
              </p>
              <p>
                {isZh 
                  ? '此操作仅会从当前 ERP 系统中清理该商品的同步缓存记录，绝对不会在亚马逊卖家后台执行下架或删除操作。' 
                  : 'This only removes the record from the local ERP system cache. Your live Amazon listing will NOT be deleted or taken down.'}
              </p>
              <p className="text-slate-400 text-[11px]">
                {isZh ? '若后续需要，随时可以再次点击【从亚马逊同步商品】重新拉取。' : 'You can sync it back anytime.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete(formData.id);
                  onClose();
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs shadow-md"
              >
                {isZh ? '确认移除本地记录' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
