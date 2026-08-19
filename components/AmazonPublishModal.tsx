import React, { useState } from 'react';
import { 
  X, Zap, CheckCircle2, AlertCircle, Loader2, 
  Package, ShoppingBag, ArrowRight, ShieldAlert, Check
} from 'lucide-react';
import { Listing, UILanguage } from '../types';
import { 
  getStoredSpApiConfig, 
  publishListingToSpApiProxy 
} from '../services/spApiService';

interface AmazonPublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedListings: Listing[];
  uiLang: UILanguage;
  onSuccess?: () => void;
  onNavigateToAmazonListings?: () => void;
}

export const AmazonPublishModal: React.FC<AmazonPublishModalProps> = ({
  isOpen,
  onClose,
  selectedListings,
  uiLang,
  onSuccess,
  onNavigateToAmazonListings
}) => {
  const [targetMarketplace, setTargetMarketplace] = useState('ATVPDKIKX0DER'); // Default US
  const [fulfillmentChannel, setFulfillmentChannel] = useState<'FBM' | 'FBA'>('FBM');
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState<number>(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [publishResults, setPublishResults] = useState<Array<{ sku: string; title: string; success: boolean; message: string; submission_id?: string }>>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const isZh = uiLang === 'zh';

  if (!isOpen) return null;

  const handleStartPublish = async () => {
    const config = getStoredSpApiConfig();
    if (!config.lwa_client_id || !config.refresh_token) {
      alert(isZh ? '请先配置 SP-API 凭证（LWA Client ID、Client Secret 及 Refresh Token）' : 'Please configure SP-API credentials first.');
      return;
    }

    if (!config.seller_id) {
      alert(isZh ? '请先在 SP-API 配置中填写 Seller ID / Merchant ID（卖家记号）' : 'Please configure Seller ID first.');
      return;
    }

    setIsPublishing(true);
    setIsCompleted(false);
    setPublishResults([]);
    setPublishProgress({ current: 0, total: selectedListings.length });

    const results: Array<{ sku: string; title: string; success: boolean; message: string; submission_id?: string }> = [];

    for (let i = 0; i < selectedListings.length; i++) {
      const listing = selectedListings[i];
      setPublishProgress({ current: i + 1, total: selectedListings.length });

      const rawTitle = listing.optimized?.optimized_title || listing.cleaned.title || '';
      // Ensure title <= 75 chars strictly
      const title = rawTitle.slice(0, 75);
      const brand = listing.cleaned.brand || 'Generic';
      const basePrice = listing.optimized?.optimized_price || listing.cleaned.price || 19.99;
      const adjustedPrice = Math.max(0.99, Number((basePrice * (1 + priceAdjustmentPercent / 100)).toFixed(2)));
      const sku = listing.cleaned.asin ? `SKU-${listing.cleaned.asin}` : `SKU-${listing.id.slice(0, 8)}`;
      const bullet_points = listing.optimized?.optimized_features || listing.cleaned.bullet_points || [];
      const description = listing.optimized?.optimized_description || listing.cleaned.description || '';
      const main_image = listing.optimized?.optimized_main_image || listing.cleaned.main_image;

      try {
        const res = await publishListingToSpApiProxy({
          ...config,
          marketplace_id: targetMarketplace
        }, {
          sku,
          asin: listing.cleaned.asin,
          marketplace_id: targetMarketplace,
          title,
          brand,
          price: adjustedPrice,
          quantity: 20,
          fulfillment_channel: fulfillmentChannel,
          bullet_points,
          description,
          main_image
        });

        results.push({
          sku,
          title,
          success: true,
          message: res.message || 'Published to SP-API',
          submission_id: res.submission_id
        });
      } catch (err: any) {
        results.push({
          sku,
          title,
          success: false,
          message: err.message || 'Publish failed'
        });
      }
    }

    setPublishResults(results);
    setIsPublishing(false);
    setIsCompleted(true);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isZh ? '批量发布商品至亚马逊 (SP-API)' : 'Publish to Amazon SP-API'}
              </h3>
              <p className="text-xs font-semibold text-slate-400">
                {isZh ? `已选择 ${selectedListings.length} 个商品准备发布` : `${selectedListings.length} items selected for publishing`}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isPublishing} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {!isCompleted ? (
          <div className="space-y-4 text-xs">
            {/* Target Marketplace */}
            <div>
              <label className="font-black text-slate-800 block mb-1.5 uppercase tracking-wider text-[11px]">
                {isZh ? '目标发布站点 (Target Marketplace)' : 'Target Marketplace'}
              </label>
              <select 
                value={targetMarketplace} 
                onChange={(e) => setTargetMarketplace(e.target.value)}
                disabled={isPublishing}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:outline-none"
              >
                <option value="ATVPDKIKX0DER">🇺🇸 美国站 (US - ATVPDKIKX0DER - USD)</option>
                <option value="A2EUQ1WTGCTBG2">🇨🇦 加拿大站 (CA - A2EUQ1WTGCTBG2 - CAD)</option>
                <option value="A1AM78C64UM0Y8">🇲🇽 墨西哥站 (MX - A1AM78C64UM0Y8 - MXN)</option>
                <option value="A1F83G8C2ARO7P">🇬🇧 英国站 (UK - A1F83G8C2ARO7P - GBP)</option>
                <option value="A1PA6795UKMFR9">🇩🇪 德国站 (DE - A1PA6795UKMFR9 - EUR)</option>
                <option value="A13V1IB3VIYZZH">🇫🇷 法国站 (FR - A13V1IB3VIYZZH - EUR)</option>
                <option value="A1VC38T7YXB528">🇯🇵 日本站 (JP - A1VC38T7YXB528 - JPY)</option>
              </select>
            </div>

            {/* Fulfillment & Price Adjustment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-black text-slate-800 block mb-1.5 uppercase tracking-wider text-[11px]">
                  {isZh ? '发货配送方式' : 'Fulfillment Channel'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => setFulfillmentChannel('FBM')}
                    className={`py-2.5 px-3 rounded-xl font-bold border transition-all text-center ${
                      fulfillmentChannel === 'FBM' ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    FBM (自配送)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFulfillmentChannel('FBA')}
                    className={`py-2.5 px-3 rounded-xl font-bold border transition-all text-center ${
                      fulfillmentChannel === 'FBA' ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    FBA (亚马逊配送)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-black text-slate-800 block mb-1.5 uppercase tracking-wider text-[11px]">
                  {isZh ? '价格浮动调价 (%)' : 'Price Adjustment (%)'}
                </label>
                <input 
                  type="number"
                  value={priceAdjustmentPercent}
                  onChange={(e) => setPriceAdjustmentPercent(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  disabled={isPublishing}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {isZh ? '正数加价，负数降价 (如 +15 表示加价 15%)' : 'e.g. +10 adds 10% to original price'}
                </span>
              </div>
            </div>

            {/* Title Length & Compliance Reminder */}
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100 text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-amber-600" />
                {isZh ? '亚马逊 SP-API 发布规范提示：' : 'Amazon SP-API Compliance:'}
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {isZh 
                  ? '1. 系统会自动截取标题为符合亚马逊标准的前 75 个字符；2. 发布成功后将在【亚马逊 > 商品管理】及后台批量上传记录中实时呈现。' 
                  : '1. Titles will be automatically validated to <= 75 chars. 2. Products will appear under Amazon > Listings Management.'}
              </p>
            </div>

            {/* Selected Items Preview */}
            <div className="space-y-2">
              <span className="font-black text-slate-700 block uppercase tracking-wider text-[10px]">
                {isZh ? '待发布商品清单' : 'Products to be published'} ({selectedListings.length})
              </span>
              <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1.5 border border-slate-100 rounded-2xl p-2">
                {selectedListings.map((l, idx) => (
                  <div key={l.id} className="flex items-center justify-between text-[11px] p-2 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-mono font-bold text-slate-400">{idx + 1}.</span>
                      <span className="font-bold text-slate-800 truncate max-w-sm">
                        {l.optimized?.optimized_title || l.cleaned.title}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 font-bold shrink-0">
                      ${((l.optimized?.optimized_price || l.cleaned.price || 19.99) * (1 + priceAdjustmentPercent / 100)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {isPublishing && (
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>{isZh ? '正在推送至亚马逊 SP-API...' : 'Publishing to SP-API...'}</span>
                  <span>{publishProgress.current} / {publishProgress.total}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(publishProgress.current / publishProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Completed Result Screen */
          <div className="space-y-4 text-xs flex-1 overflow-y-auto custom-scrollbar">
            <div className="text-center py-4 space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-base font-black text-slate-900">
                {isZh ? '发布批次处理完成' : 'Publish Batch Complete'}
              </h4>
              <p className="text-slate-500 text-xs">
                {isZh 
                  ? `成功: ${publishResults.filter(r => r.success).length} | 失败: ${publishResults.filter(r => !r.success).length}`
                  : `Success: ${publishResults.filter(r => r.success).length} | Failed: ${publishResults.filter(r => !r.success).length}`}
              </p>
            </div>

            <div className="space-y-2">
              {publishResults.map((r, idx) => (
                <div key={idx} className={`p-3 rounded-2xl border text-xs space-y-1 ${
                  r.success ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800">{r.sku}</span>
                    <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                      r.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {r.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium line-clamp-1">{r.title}</p>
                  <p className={`text-[11px] font-medium ${r.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {r.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
          {!isCompleted ? (
            <>
              <button 
                onClick={onClose} 
                disabled={isPublishing}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button 
                onClick={handleStartPublish}
                disabled={isPublishing || selectedListings.length === 0}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black shadow-lg shadow-amber-200 flex items-center gap-2 disabled:opacity-50"
              >
                {isPublishing ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                {isPublishing ? (isZh ? '正在发布...' : 'Publishing...') : (isZh ? '确认发布至 SP-API' : 'Confirm Publish')}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-end gap-3 w-full">
              {onNavigateToAmazonListings && (
                <button 
                  onClick={() => {
                    onClose();
                    onNavigateToAmazonListings();
                  }}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black shadow-md flex items-center gap-1.5"
                >
                  <ShoppingBag size={14} />
                  {isZh ? '前往亚马逊商品管理查看' : 'View Amazon Listings'}
                </button>
              )}
              <button 
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold"
              >
                {isZh ? '完成' : 'Done'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
