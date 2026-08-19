import React, { useState } from 'react';
import { 
  X, Upload, FileText, CheckCircle2, AlertCircle, Sparkles, 
  HelpCircle, Download, ArrowRight, Layers, Table, Info
} from 'lucide-react';
import { AmazonProduct, UILanguage } from '../types';
import { saveStoredAmazonProducts, getStoredAmazonProducts } from '../services/spApiService';

interface AmazonReportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang: UILanguage;
  onImportComplete: (items: AmazonProduct[]) => void;
}

export const AmazonReportImportModal: React.FC<AmazonReportImportModalProps> = ({
  isOpen,
  onClose,
  uiLang,
  onImportComplete
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text' | 'sample'>('file');
  const [pastedText, setPastedText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<AmazonProduct[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const isZh = uiLang === 'zh';

  // Helper to parse TSV or CSV from Amazon Seller Central
  const parseReportContent = (rawText: string): AmazonProduct[] => {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    // Detect delimiter: tab or comma
    const firstLine = lines[0];
    const isTab = firstLine.includes('\t');
    const delimiter = isTab ? '\t' : ',';

    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    
    // Header Index Finders
    const findIndex = (names: string[]) => {
      return headers.findIndex(h => names.some(name => h === name || h.includes(name)));
    };

    const skuIdx = findIndex(['seller-sku', 'sku', 'sellersku', 'seller_sku']);
    const asinIdx = findIndex(['asin1', 'asin', 'product-id', 'item-id']);
    const titleIdx = findIndex(['item-name', 'title', 'item_name', 'product-name']);
    const priceIdx = findIndex(['price', 'item-price', 'price-amount', 'our-price']);
    const qtyIdx = findIndex(['quantity', 'qty', 'quantity-available', 'inventory']);
    const channelIdx = findIndex(['fulfillment-channel', 'channel', 'fulfillment_channel']);
    const statusIdx = findIndex(['status', 'item-status']);
    const descIdx = findIndex(['item-description', 'description', 'bullet-point']);
    const parentAsinIdx = findIndex(['parent-asin', 'parentasin', 'variation-parent']);
    const parentSkuIdx = findIndex(['parent-sku', 'parentsku']);

    const results: AmazonProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let cols: string[];
      if (isTab) {
        cols = line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
      } else {
        // Simple CSV splitter
        cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      }

      const sku = (skuIdx >= 0 ? cols[skuIdx] : '') || `SKU-${i}`;
      const asin = (asinIdx >= 0 ? cols[asinIdx] : '') || '';
      const title = (titleIdx >= 0 ? cols[titleIdx] : '') || `Amazon Product (${sku})`;
      const rawPrice = priceIdx >= 0 ? parseFloat(cols[priceIdx]) : 29.99;
      const price = isNaN(rawPrice) ? 29.99 : rawPrice;
      const rawQty = qtyIdx >= 0 ? parseInt(cols[qtyIdx], 10) : 50;
      const quantity = isNaN(rawQty) ? 50 : rawQty;
      const channel = channelIdx >= 0 && (cols[channelIdx].includes('AMAZON') || cols[channelIdx].includes('FBA')) ? 'FBA' : 'FBM';
      const statusStr = (statusIdx >= 0 ? cols[statusIdx] : '').toLowerCase();
      const status: 'Active' | 'Inactive' | 'Draft' = statusStr.includes('inactive') ? 'Inactive' : 'Active';
      const parentAsin = parentAsinIdx >= 0 ? cols[parentAsinIdx] : undefined;
      const parentSku = parentSkuIdx >= 0 ? cols[parentSkuIdx] : undefined;

      // Detect color or size variation from title or SKU
      let variationName = '';
      let colorName: string | undefined = undefined;
      let sizeName: string | undefined = undefined;

      const colorMatch = title.match(/\b(Black|Sage Green|Navy|Burgundy|White|Blue|Red|Pink|Grey|Gray|Purple|Green|Yellow|Orange)\b/i) || sku.match(/-(BLK|GRN|NAV|BUR|WHT|BLU|RED|PNK)-/i);
      if (colorMatch) colorName = colorMatch[1].toUpperCase();

      const sizeMatch = title.match(/\b(Small|Medium|Large|X-Large|XX-Large|XS|S|M|L|XL|2XL|3XL)\b/i) || sku.match(/-(XS|S|M|L|XL|2XL|3XL)$/i);
      if (sizeMatch) sizeName = sizeMatch[1].toUpperCase();

      if (colorName && sizeName) variationName = `Color: ${colorName}, Size: ${sizeName}`;
      else if (colorName) variationName = `Color: ${colorName}`;
      else if (sizeName) variationName = `Size: ${sizeName}`;

      results.push({
        id: `amz-import-${sku}`,
        sku,
        asin,
        parent_asin: parentAsin || (colorName || sizeName ? 'PARENT-AUTO' : undefined),
        parent_sku: parentSku || (colorName || sizeName ? 'PARENT-AUTO-SKU' : undefined),
        variation_theme: colorName && sizeName ? 'Color-Size' : (colorName ? 'Color' : sizeName ? 'Size' : undefined),
        variation_name: variationName || undefined,
        color_name: colorName,
        size_name: sizeName,
        title,
        brand: 'My Store Brand',
        marketplace: 'ATVPDKIKX0DER',
        price,
        currency: 'USD',
        quantity,
        status,
        fulfillment_channel: channel,
        main_image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
        description: descIdx >= 0 ? cols[descIdx] : '',
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    }

    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseReportContent(text);
        if (parsed.length === 0) {
          setErrorMessage(isZh ? '未能从该文件中解析出有效商品，请确保文件包含 seller-sku、asin、item-name 等字段。' : 'No valid products parsed from file.');
        } else {
          setParsedPreview(parsed);
        }
      } catch (err: any) {
        setErrorMessage(err.message || '文件解析失败');
      }
    };
    reader.readAsText(file);
  };

  const handleParsePastedText = () => {
    setErrorMessage(null);
    if (!pastedText.trim()) {
      setErrorMessage(isZh ? '请输入或粘贴库存报告文本/表格数据' : 'Please enter or paste report text');
      return;
    }
    try {
      const parsed = parseReportContent(pastedText);
      if (parsed.length === 0) {
        setErrorMessage(isZh ? '解析失败：未识别出商品，请检查格式' : 'Parse failed');
      } else {
        setParsedPreview(parsed);
      }
    } catch (err: any) {
      setErrorMessage(err.message || '解析错误');
    }
  };

  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) return;
    setIsProcessing(true);
    try {
      const current = getStoredAmazonProducts();
      const map = new Map<string, AmazonProduct>();
      // Keep existing, merge new
      current.forEach(p => map.set(p.sku, p));
      parsedPreview.forEach(p => map.set(p.sku, p));
      const merged = Array.from(map.values());
      
      saveStoredAmazonProducts(merged);
      onImportComplete(merged);
      alert(isZh ? `成功导入 ${parsedPreview.length} 个店铺真实商品！` : `Successfully imported ${parsedPreview.length} items!`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || '保存失败');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-950 font-black shadow-lg">
              <Upload size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">
                {isZh ? '导入亚马逊卖家中心库存报告' : 'Import Amazon Seller Central Inventory Report'}
              </h3>
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-0.5">
                {isZh ? '100% 准确同步您店铺的真实在售商品与变体' : 'Direct 100% Store Inventory Report Sync'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-8 pt-4 pb-2 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <button 
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'file' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-200' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Upload size={14} /> {isZh ? '上传报告文件 (.txt / .csv)' : 'Upload File'}
          </button>

          <button 
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'text' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-200' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText size={14} /> {isZh ? '粘贴表格文本' : 'Paste Raw Text'}
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* Guide banner */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3">
            <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 space-y-1 font-medium">
              <span className="font-bold block">
                {isZh ? '如何从亚马逊后台下载库存报告？' : 'How to download Active Listings Report from Amazon?'}
              </span>
              <p className="text-indigo-800/90 leading-relaxed">
                {isZh 
                  ? '登录亚马逊卖家平台 (Seller Central) -> 点击顶部菜单「数据报告 (Reports)」->「库存报告 (Inventory Reports)」-> 选择「在售商品报告 (Active Listings Report)」或「所有商品报告 (All Listings Report)」-> 点击“请求报告”，生成后下载文本文件直接上传即可！'
                  : 'In Seller Central, navigate to Reports -> Inventory Reports -> Select "Active Listings Report" -> Click "Request Report" -> Download the TXT/CSV file and upload it here!'}
              </p>
            </div>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'file' && (
            <div className="border-2 border-dashed border-slate-200 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/20 rounded-3xl p-10 text-center transition-all">
              <input 
                type="file" 
                id="report-file-input"
                accept=".txt,.tsv,.csv,.xlsx,.tab" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
              <label htmlFor="report-file-input" className="cursor-pointer flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
                  <Upload size={32} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">
                    {isZh ? '点击或拖拽上传亚马逊库存报告文件' : 'Click to Upload Active Listings Report'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    {isZh ? '支持 .txt、.tsv、.csv 格式的亚马逊官方 Active Listings Report' : 'Supports .txt, .tsv, .csv Active Listings Report exports'}
                  </p>
                </div>
                <span className="mt-2 px-5 py-2.5 bg-slate-900 text-white hover:bg-amber-500 hover:text-slate-950 font-black text-xs rounded-2xl shadow-lg transition-all">
                  {isZh ? '选择文件' : 'Browse File'}
                </span>
              </label>
            </div>
          )}

          {/* Tab 2: Paste Raw Text */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <textarea 
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={isZh 
                  ? "请粘贴从 Excel 或记事本复制的报告内容，例如：\nitem-name\tseller-sku\tprice\tquantity\tasin1\nYoga Pants Black S\tYOGA-BLK-S\t26.99\t100\tB09YOGA01S" 
                  : "Paste TSV / CSV rows here..."}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:border-amber-500"
              />
              <button 
                onClick={handleParsePastedText}
                className="px-5 py-2.5 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2"
              >
                <Sparkles size={14} /> {isZh ? '解析粘贴的数据' : 'Parse Pasted Data'}
              </button>
            </div>
          )}

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  {isZh ? `解析成功：共发现 ${parsedPreview.length} 个属于您店铺的商品/变体` : `Parsed ${parsedPreview.length} items`}
                </span>
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  {isZh ? '请核对并点击下方确认导入' : 'Ready to import'}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3">ASIN</th>
                      <th className="p-3">{isZh ? '商品标题' : 'Title'}</th>
                      <th className="p-3">{isZh ? '售价' : 'Price'}</th>
                      <th className="p-3">{isZh ? '库存' : 'Qty'}</th>
                      <th className="p-3">{isZh ? '渠道' : 'Fulfillment'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedPreview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-900">{item.sku}</td>
                        <td className="p-3 font-mono text-slate-500">{item.asin || '-'}</td>
                        <td className="p-3 font-medium text-slate-800 truncate max-w-xs">{item.title}</td>
                        <td className="p-3 font-bold text-slate-900">${item.price}</td>
                        <td className="p-3 font-bold text-emerald-600">{item.quantity}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            {item.fulfillment_channel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all"
          >
            {isZh ? '取消' : 'Cancel'}
          </button>

          <button 
            onClick={handleConfirmImport}
            disabled={parsedPreview.length === 0 || isProcessing}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 rounded-2xl text-xs font-black shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            {isProcessing ? (isZh ? '正在导入...' : 'Importing...') : (isZh ? `确认导入这 ${parsedPreview.length} 个商品到店铺列表` : `Confirm Import (${parsedPreview.length} items)`)}
          </button>
        </div>

      </div>
    </div>
  );
};
