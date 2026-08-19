import React, { useState } from 'react';
import { 
  X, Plus, CheckCircle2, AlertCircle, Sparkles, Layers, 
  Package, DollarSign, Hash, Tag, FileText
} from 'lucide-react';
import { AmazonProduct, UILanguage } from '../types';
import { upsertAmazonProduct, getStoredAmazonProducts, saveStoredAmazonProducts } from '../services/spApiService';

interface AmazonQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang: UILanguage;
  onProductAdded: (products: AmazonProduct[]) => void;
}

export const AmazonQuickAddModal: React.FC<AmazonQuickAddModalProps> = ({
  isOpen,
  onClose,
  uiLang,
  onProductAdded
}) => {
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const isZh = uiLang === 'zh';

  // Single Item Form
  const [sku, setSku] = useState('');
  const [asin, setAsin] = useState('');
  const [parentAsin, setParentAsin] = useState('');
  const [parentSku, setParentSku] = useState('');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('29.99');
  const [quantity, setQuantity] = useState('100');
  const [fulfillmentChannel, setFulfillmentChannel] = useState<'FBA' | 'FBM'>('FBA');
  const [colorName, setColorName] = useState('');
  const [sizeName, setSizeName] = useState('');
  const [mainImage, setMainImage] = useState('https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80');

  // Batch Form
  const [batchText, setBatchText] = useState('');
  const [batchCommonTitle, setBatchCommonTitle] = useState('');
  const [batchParentAsin, setBatchParentAsin] = useState('');

  if (!isOpen) return null;

  const handleSaveSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      alert(isZh ? '请填写商品 SKU' : 'SKU is required');
      return;
    }

    let variationName = '';
    if (colorName && sizeName) variationName = `Color: ${colorName}, Size: ${sizeName}`;
    else if (colorName) variationName = `Color: ${colorName}`;
    else if (sizeName) variationName = `Size: ${sizeName}`;

    const newProduct: AmazonProduct = {
      id: `amz-manual-${sku.trim()}`,
      sku: sku.trim(),
      asin: asin.trim() || '',
      parent_asin: parentAsin.trim() || undefined,
      parent_sku: parentSku.trim() || undefined,
      variation_theme: (colorName || sizeName) ? 'Color-Size' : undefined,
      variation_name: variationName || undefined,
      color_name: colorName.trim() || undefined,
      size_name: sizeName.trim() || undefined,
      title: title.trim() || `Amazon Product (${sku.trim()})`,
      brand: brand.trim() || 'My Brand',
      marketplace: 'ATVPDKIKX0DER',
      price: parseFloat(price) || 29.99,
      currency: 'USD',
      quantity: parseInt(quantity, 10) || 50,
      status: 'Active',
      fulfillment_channel: fulfillmentChannel,
      main_image: mainImage.trim() || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const updated = upsertAmazonProduct(newProduct);
    onProductAdded(updated);
    alert(isZh ? `成功添加商品 [${sku}] 到店铺商品库！` : `Successfully added listing [${sku}]!`);
    onClose();
  };

  const handleSaveBatch = () => {
    if (!batchText.trim()) {
      alert(isZh ? '请输入 SKU / ASIN 列表' : 'Please input SKUs/ASINs');
      return;
    }

    const lines = batchText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const current = getStoredAmazonProducts();
    const map = new Map<string, AmazonProduct>();
    current.forEach(p => map.set(p.sku, p));

    lines.forEach((line, idx) => {
      // Line format: SKU or "SKU ASIN Price Color Size" or comma separated
      const parts = line.split(/[,\t\s]+/).filter(Boolean);
      const itemSku = parts[0] || `SKU-${idx + 1}`;
      const itemAsin = parts[1] && parts[1].startsWith('B0') ? parts[1] : (parts[0].startsWith('B0') ? parts[0] : '');
      const itemPrice = parts[2] && !isNaN(parseFloat(parts[2])) ? parseFloat(parts[2]) : 26.99;
      const itemColor = parts[3] || '';
      const itemSize = parts[4] || '';

      let variationName = '';
      if (itemColor && itemSize) variationName = `Color: ${itemColor}, Size: ${itemSize}`;
      else if (itemColor) variationName = `Color: ${itemColor}`;
      else if (itemSize) variationName = `Size: ${itemSize}`;

      const title = batchCommonTitle 
        ? `${batchCommonTitle} (${itemColor} ${itemSize})`.trim()
        : `Product ${itemSku}`;

      map.set(itemSku, {
        id: `amz-manual-${itemSku}`,
        sku: itemSku,
        asin: itemAsin || '',
        parent_asin: batchParentAsin.trim() || undefined,
        parent_sku: batchParentAsin.trim() ? `${batchParentAsin.trim()}-PARENT` : undefined,
        variation_theme: (itemColor || itemSize) ? 'Color-Size' : undefined,
        variation_name: variationName || undefined,
        color_name: itemColor || undefined,
        size_name: itemSize || undefined,
        title: title,
        brand: 'My Store Brand',
        marketplace: 'ATVPDKIKX0DER',
        price: itemPrice,
        currency: 'USD',
        quantity: 100,
        status: 'Active',
        fulfillment_channel: 'FBA',
        main_image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    });

    const merged = Array.from(map.values());
    saveStoredAmazonProducts(merged);
    onProductAdded(merged);
    alert(isZh ? `成功批量录入 ${lines.length} 个店铺商品！` : `Successfully added ${lines.length} items!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-950 font-black shadow-lg">
              <Plus size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">
                {isZh ? '录入/添加店铺真实商品' : 'Add Store Listings'}
              </h3>
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-0.5">
                {isZh ? '手动录入单品或批量录入 SKU/变体' : 'Direct Manual / Batch Input'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 pb-2 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <button 
            onClick={() => setTab('single')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              tab === 'single' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-200' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package size={14} /> {isZh ? '单个商品录入' : 'Single Listing'}
          </button>

          <button 
            onClick={() => setTab('batch')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              tab === 'batch' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-200' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers size={14} /> {isZh ? '批量粘贴 SKU/变体录入' : 'Batch Paste SKUs'}
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {tab === 'single' ? (
            <form onSubmit={handleSaveSingle} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '卖家 SKU (必填)' : 'Seller SKU (Required)'}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="例如: MY-STORE-SKU-001"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '商品 ASIN' : 'ASIN'}
                  </label>
                  <input 
                    type="text" 
                    value={asin}
                    onChange={e => setAsin(e.target.value)}
                    placeholder="例如: B0XXXXXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1">
                  {isZh ? '商品标题 (Title)' : 'Product Title'}
                </label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="例如: Seamless High Waist Workout Leggings"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '父体 ASIN (若属于父子变体)' : 'Parent ASIN'}
                  </label>
                  <input 
                    type="text" 
                    value={parentAsin}
                    onChange={e => setParentAsin(e.target.value)}
                    placeholder="例如: B09-PARENT-01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '发货方式' : 'Fulfillment Channel'}
                  </label>
                  <select 
                    value={fulfillmentChannel}
                    onChange={e => setFulfillmentChannel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 focus:outline-none"
                  >
                    <option value="FBA">FBA (亚马逊配送 / 亚马逊库存)</option>
                    <option value="FBM">FBM (卖家自发货)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '价格 (USD)' : 'Price ($)'}
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '库存数量' : 'Quantity'}
                  </label>
                  <input 
                    type="number" 
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '颜色 / 尺码' : 'Color / Size'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Color"
                      value={colorName}
                      onChange={e => setColorName(e.target.value)}
                      className="w-1/2 px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-amber-500 focus:outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Size"
                      value={sizeName}
                      onChange={e => setSizeName(e.target.value)}
                      className="w-1/2 px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {isZh ? '保存并添加至商品列表' : 'Save Listing'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-bold">
                {isZh 
                  ? '每行输入一个 SKU 或变体信息，支持格式：SKU [ASIN] [价格] [颜色] [尺码]，以空格或逗号分隔。' 
                  : 'Enter one SKU per line. Format: SKU [ASIN] [Price] [Color] [Size]'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '通用商品族标题' : 'Common Family Title'}
                  </label>
                  <input 
                    type="text" 
                    value={batchCommonTitle}
                    onChange={e => setBatchCommonTitle(e.target.value)}
                    placeholder="例如: FitAura Seamless High-Waist Yoga Pants"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1">
                    {isZh ? '统一父体 ASIN (选填)' : 'Parent ASIN (Optional)'}
                  </label>
                  <input 
                    type="text" 
                    value={batchParentAsin}
                    onChange={e => setBatchParentAsin(e.target.value)}
                    placeholder="例如: B09-PARENT-01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1">
                  {isZh ? 'SKU 列表 (每行一条)' : 'SKU Lines'}
                </label>
                <textarea 
                  rows={6}
                  value={batchText}
                  onChange={e => setBatchText(e.target.value)}
                  placeholder={isZh ? "YOGA-BLK-S B09YOGA01S 26.99 Black Small\nYOGA-BLK-M B09YOGA02M 26.99 Black Medium\nYOGA-BLK-L B09YOGA03L 26.99 Black Large" : "SKU-001 B001 29.99\nSKU-002 B002 29.99"}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={handleSaveBatch}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {isZh ? '批量添加至商品列表' : 'Add All Listings'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
