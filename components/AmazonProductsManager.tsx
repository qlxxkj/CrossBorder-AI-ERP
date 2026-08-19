import React, { useState, useEffect } from 'react';
import { 
  Package, Search, RefreshCw, Plus, ExternalLink, Trash2, Edit3, 
  CheckCircle2, AlertCircle, Clock, ArrowUpRight, Zap, Filter, 
  Layers, ShoppingBag, ShieldCheck, Download, Check, AlertTriangle, X
} from 'lucide-react';
import { AmazonProduct, AmazonFeedLog, UILanguage, Listing } from '../types';
import { 
  getStoredAmazonProducts, 
  saveStoredAmazonProducts, 
  deleteStoredAmazonProduct,
  importListingsFromSpApiProxy,
  publishListingToSpApiProxy,
  getStoredSpApiConfig,
  getStoredFeedLogs
} from '../services/spApiService';

interface AmazonProductsManagerProps {
  uiLang: UILanguage;
  onOpenPublishModal?: () => void;
  onOpenSettings?: () => void;
  erpListings?: Listing[];
}

export const AmazonProductsManager: React.FC<AmazonProductsManagerProps> = ({
  uiLang,
  onOpenPublishModal,
  onOpenSettings,
  erpListings = []
}) => {
  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AmazonProduct | null>(null);
  const [feedLogsModalOpen, setFeedLogsModalOpen] = useState(false);
  const [feedLogs, setFeedLogs] = useState<AmazonFeedLog[]>([]);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const isZh = uiLang === 'zh';

  useEffect(() => {
    loadProducts();
    setFeedLogs(getStoredFeedLogs());
  }, []);

  const loadProducts = () => {
    const list = getStoredAmazonProducts();
    setProducts(list);
  };

  const handleSyncFromAmazon = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const config = getStoredSpApiConfig();
      if (!config.lwa_client_id || !config.refresh_token) {
        alert(isZh ? '请先配置 SP-API 凭证（LWA Client ID、Client Secret 及 Refresh Token）' : 'Please configure SP-API credentials first.');
        if (onOpenSettings) onOpenSettings();
        return;
      }

      const res = await importListingsFromSpApiProxy(config);
      setProducts(res.items);
      setSyncNotice(
        isZh 
          ? `成功同步 ${res.count} 个亚马逊商品！数据来源：${res.source || 'SP-API'}` 
          : `Successfully synced ${res.count} listings from Amazon SP-API!`
      );
      setTimeout(() => setSyncNotice(null), 6000);
    } catch (err: any) {
      alert(err.message || (isZh ? '同步商品失败' : 'Failed to sync listings'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(isZh ? '确定从本地管理列表中移除该亚马逊商品吗？（不会直接在亚马逊后台下架）' : 'Remove this product from local manager?')) return;
    const updated = deleteStoredAmazonProduct(id);
    setProducts(updated);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(isZh ? `确定移除选中的 ${selectedIds.size} 个商品吗？` : `Remove ${selectedIds.size} selected items?`)) return;
    const current = getStoredAmazonProducts();
    const updated = current.filter(p => !selectedIds.has(p.id));
    saveStoredAmazonProducts(updated);
    setProducts(updated);
    setSelectedIds(new Set());
  };

  const handlePushSingle = async (p: AmazonProduct) => {
    try {
      const config = getStoredSpApiConfig();
      const res = await publishListingToSpApiProxy(config, {
        sku: p.sku,
        asin: p.asin,
        title: p.title,
        brand: p.brand,
        price: p.price,
        quantity: p.quantity,
        fulfillment_channel: p.fulfillment_channel === 'FBA' ? 'FBA' : 'FBM',
        bullet_points: p.bullet_points,
        description: p.description
      });
      alert(res.message || (isZh ? '发布/更新成功！' : 'Push successful!'));
      loadProducts();
      setFeedLogs(getStoredFeedLogs());
    } catch (err: any) {
      alert(err.message || (isZh ? '推送失败' : 'Push failed'));
      setFeedLogs(getStoredFeedLogs());
    }
  };

  const handleSaveEdit = () => {
    if (!editingProduct) return;
    const current = getStoredAmazonProducts();
    const updated = current.map(p => p.id === editingProduct.id ? editingProduct : p);
    saveStoredAmazonProducts(updated);
    setProducts(updated);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.asin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesMarketplace = marketplaceFilter === 'ALL' || p.marketplace === marketplaceFilter;
    const matchesFulfillment = fulfillmentFilter === 'ALL' || p.fulfillment_channel === fulfillmentFilter;
    return matchesSearch && matchesStatus && matchesMarketplace && matchesFulfillment;
  });

  const activeCount = products.filter(p => p.status === 'Active').length;
  const fbaCount = products.filter(p => p.fulfillment_channel === 'FBA').length;
  const draftCount = products.filter(p => p.status === 'Draft' || p.status === 'Syncing').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
              <Package size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {isZh ? '亚马逊商品管理' : 'Amazon Listings Management'}
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold uppercase">
                  SP-API Private
                </span>
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {isZh ? '管理从 SP-API 同步或由系统上传发布的全部亚马逊商品与库存' : 'Manage synchronized and published listings via Amazon SP-API'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => { setFeedLogs(getStoredFeedLogs()); setFeedLogsModalOpen(true); }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black transition-all flex items-center gap-2"
          >
            <Clock size={15} /> {isZh ? '上传记录与日志' : 'Submission Logs'}
          </button>

          {onOpenPublishModal && (
            <button 
              onClick={onOpenPublishModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <Plus size={15} /> {isZh ? '从产品库发布' : 'Publish from ERP'}
            </button>
          )}

          <button 
            onClick={handleSyncFromAmazon}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-xs font-black shadow-lg shadow-amber-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? (isZh ? '正在从亚马逊同步...' : 'Syncing...') : (isZh ? '从亚马逊同步商品' : 'Sync from Amazon')}
          </button>
        </div>
      </div>

      {/* Sync Notice Alert */}
      {syncNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{syncNotice}</span>
          </div>
          <button onClick={() => setSyncNotice(null)} className="text-emerald-600 hover:text-emerald-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isZh ? '全部商品总量' : 'Total Listings'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{products.length}</span>
            <span className="text-xs font-bold text-slate-400">{isZh ? 'SKU' : 'items'}</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{isZh ? '在线在售 (Active)' : 'Active Listings'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600">{activeCount}</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{isZh ? '亚马逊配送 (FBA)' : 'FBA Fulfilled'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-600">{fbaCount}</span>
            <Zap size={18} className="text-indigo-500" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">{isZh ? '草稿/同步中 (Draft/Sync)' : 'Draft / Syncing'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">{draftCount}</span>
            <Clock size={18} className="text-amber-500" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isZh ? "搜索 SKU、ASIN、标题、品牌..." : "Search SKU, ASIN, Title..."}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
          <select 
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '所有站点 (All Markets)' : 'All Marketplaces'}</option>
            <option value="US">🇺🇸 美国 (US - ATVPDKIKX0DER)</option>
            <option value="CA">🇨🇦 加拿大 (CA - A2EUQ1WTGCTBG2)</option>
            <option value="UK">🇬🇧 英国 (UK - A1F83G8C2ARO7P)</option>
            <option value="DE">🇩🇪 德国 (DE - A1PA6795UKMFR9)</option>
            <option value="JP">🇯🇵 日本 (JP - A1VC38T7YXB528)</option>
          </select>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '全部状态 (All Status)' : 'All Status'}</option>
            <option value="Active">{isZh ? '在售 (Active)' : 'Active'}</option>
            <option value="Draft">{isZh ? '草稿 (Draft)' : 'Draft'}</option>
            <option value="Inactive">{isZh ? '下架 (Inactive)' : 'Inactive'}</option>
            <option value="Error">{isZh ? '异常 (Error)' : 'Error'}</option>
          </select>

          <select 
            value={fulfillmentFilter}
            onChange={(e) => setFulfillmentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '全部配送方式' : 'All Fulfillment'}</option>
            <option value="FBA">FBA (亚马逊配送)</option>
            <option value="FBM">FBM (卖家自发货)</option>
          </select>

          {selectedIds.size > 0 && (
            <button 
              onClick={handleBatchDelete}
              className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 size={13} /> {isZh ? `删除 (${selectedIds.size})` : `Delete (${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
              <Package size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                {products.length === 0 
                  ? (isZh ? '暂无已同步的亚马逊商品' : 'No Amazon Listings Found') 
                  : (isZh ? '没有符合筛选条件的商品' : 'No products match filter')}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {products.length === 0 
                  ? (isZh ? '点击右上角【从亚马逊同步商品】快速载入现有库存，或点击【从产品库发布】将优化好的商品推送到亚马逊。' : 'Click "Sync from Amazon" to import current catalog or "Publish from ERP" to push new listings.')
                  : (isZh ? '请尝试重置搜索词或筛选条件。' : 'Try clearing search keyword or filters.')}
              </p>
            </div>
            {products.length === 0 && (
              <div className="flex justify-center gap-3 pt-2">
                <button 
                  onClick={handleSyncFromAmazon}
                  disabled={isSyncing}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-xs font-black shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isZh ? '立即从亚马逊同步' : 'Sync from Amazon Now'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-4 px-5 w-12 text-center">
                    <input 
                      type="checkbox"
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(filteredProducts.map(p => p.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                  </th>
                  <th className="py-4 px-4 w-16">{isZh ? '图片' : 'Image'}</th>
                  <th className="py-4 px-4">{isZh ? '商品信息 (SKU / ASIN / 标题)' : 'Product Details'}</th>
                  <th className="py-4 px-4">{isZh ? '站点' : 'Market'}</th>
                  <th className="py-4 px-4">{isZh ? '售价' : 'Price'}</th>
                  <th className="py-4 px-4">{isZh ? '库存' : 'Stock'}</th>
                  <th className="py-4 px-4">{isZh ? '配送方式' : 'Fulfillment'}</th>
                  <th className="py-4 px-4">{isZh ? '状态' : 'Status'}</th>
                  <th className="py-4 px-5 text-right">{isZh ? '操作' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                {filteredProducts.map(p => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-4 px-5 text-center">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            setSelectedIds(next);
                          }}
                          className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                        />
                      </td>

                      <td className="py-4 px-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                          {p.main_image ? (
                            <img src={p.main_image} alt={p.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package size={20} className="text-slate-300" />
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-md">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 line-clamp-2" title={p.title}>
                            {p.title}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              SKU: {p.sku}
                            </span>
                            {p.asin && (
                              <a 
                                href={`https://www.amazon.com/dp/${p.asin}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="font-mono text-amber-600 hover:text-amber-700 flex items-center gap-0.5 hover:underline"
                              >
                                ASIN: {p.asin} <ExternalLink size={10} />
                              </a>
                            )}
                            {p.brand && <span>{p.brand}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {p.marketplace}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-black text-slate-900 text-sm">
                          {p.currency === 'USD' ? '$' : p.currency === 'EUR' ? '€' : p.currency === 'GBP' ? '£' : '¥'}{p.price.toFixed(2)}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`font-bold ${p.quantity <= 5 ? 'text-red-500' : 'text-slate-700'}`}>
                          {p.quantity}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          p.fulfillment_channel === 'FBA' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.fulfillment_channel}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            p.status === 'Active' ? 'bg-emerald-500' : p.status === 'Draft' ? 'bg-amber-500' : 'bg-slate-300'
                          }`} />
                          <span className="font-bold text-xs">{p.status}</span>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handlePushSingle(p)}
                            title={isZh ? "通过 SP-API 推送/更新至亚马逊" : "Push to Amazon via SP-API"}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          >
                            <Zap size={15} />
                          </button>
                          <button 
                            onClick={() => setEditingProduct(p)}
                            title={isZh ? "编辑商品" : "Edit"}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => handleDelete(p.id)}
                            title={isZh ? "从本地列表移除" : "Remove"}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {isZh ? '编辑亚马逊商品信息' : 'Edit Amazon Product'}
              </h3>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">SKU</label>
                <input 
                  type="text" 
                  value={editingProduct.sku} 
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ASIN</label>
                <input 
                  type="text" 
                  value={editingProduct.asin} 
                  onChange={(e) => setEditingProduct({ ...editingProduct, asin: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isZh ? '商品标题 (建议 <= 75 字符)' : 'Title (Max 75 chars recommended)'}
                </label>
                <input 
                  type="text" 
                  value={editingProduct.title} 
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {editingProduct.title.length} / 75 chars
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isZh ? '售价' : 'Price'}</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={editingProduct.price} 
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isZh ? '库存数量' : 'Quantity'}</label>
                  <input 
                    type="number" 
                    value={editingProduct.quantity} 
                    onChange={(e) => setEditingProduct({ ...editingProduct, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isZh ? '状态' : 'Status'}</label>
                  <select 
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{isZh ? '配送模式' : 'Fulfillment'}</label>
                  <select 
                    value={editingProduct.fulfillment_channel}
                    onChange={(e) => setEditingProduct({ ...editingProduct, fulfillment_channel: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="FBM">FBM (卖家自发货)</option>
                    <option value="FBA">FBA (亚马逊配送)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button 
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black shadow-md"
              >
                {isZh ? '保存更改' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed & Submission Logs Modal */}
      {feedLogsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                <h3 className="text-base font-black text-slate-900">
                  {isZh ? 'SP-API 上传记录与 Feed 批次状态' : 'SP-API Submission & Feed Logs'}
                </h3>
              </div>
              <button onClick={() => setFeedLogsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
              {feedLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  {isZh ? '暂无上传记录。当您发布商品时，SP-API 的提交批次与诊断信息将记录于此。' : 'No submission records yet.'}
                </div>
              ) : (
                feedLogs.map(log => (
                  <div key={log.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase ${
                          log.status === 'ACCEPTED' || log.status === 'DONE' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : log.status === 'ERROR' || log.status === 'FATAL'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.status}
                        </span>
                        <span className="font-mono font-bold text-slate-700">
                          ID: {log.submission_id}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          ({log.marketplace_id})
                        </span>
                      </div>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-slate-600 font-medium">
                      {log.response_summary || 'Listing submission request'}
                    </div>

                    {log.sku_list && log.sku_list.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        <span className="font-bold">{isZh ? '涉及 SKU: ' : 'SKUs: '}</span>
                        {log.sku_list.join(', ')}
                      </div>
                    )}

                    {log.error_details && log.error_details.length > 0 && (
                      <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-[11px] font-mono space-y-1">
                        {log.error_details.map((err, idx) => (
                          <div key={idx} className="flex items-start gap-1">
                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-400">
                {isZh ? `共 ${feedLogs.length} 条记录` : `${feedLogs.length} logs`}
              </span>
              <button 
                onClick={() => setFeedLogsModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold"
              >
                {isZh ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
