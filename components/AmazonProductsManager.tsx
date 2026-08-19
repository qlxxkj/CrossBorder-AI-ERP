import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, Search, RefreshCw, Plus, ExternalLink, Trash2, Edit3, 
  CheckCircle2, AlertCircle, Clock, ArrowUpRight, Zap, Filter, 
  Layers, ShoppingBag, ShieldCheck, Download, Check, AlertTriangle, X,
  ChevronDown, ChevronRight, ChevronsUpDown, List, Grid, ChevronLeft,
  ChevronsLeft, ChevronsRight, Tag, Boxes, ArrowUpDown, Eye, Info
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
import { AmazonListingDetailModal } from './AmazonListingDetailModal';

interface AmazonProductsManagerProps {
  uiLang: UILanguage;
  onOpenPublishModal?: () => void;
  onOpenSettings?: () => void;
  erpListings?: Listing[];
}

interface ProductGroup {
  groupId: string;
  isFamily: boolean;
  parentAsin?: string;
  parentSku?: string;
  variationTheme?: string;
  title: string;
  brand?: string;
  marketplace: string;
  mainImage?: string;
  children: AmazonProduct[];
  minPrice: number;
  maxPrice: number;
  totalQuantity: number;
  currency: string;
  allFba: boolean;
  allFbm: boolean;
  hasActive: boolean;
  hasDraft: boolean;
}

const PAGE_SIZES = [10, 20, 50, 100];

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
  const [variationFilter, setVariationFilter] = useState<string>('ALL'); // 'ALL' | 'PARENT' | 'SINGLE'
  const [viewMode, setViewMode] = useState<'hierarchy' | 'flat'>('hierarchy');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AmazonProduct | null>(null);
  const [feedLogsModalOpen, setFeedLogsModalOpen] = useState(false);
  const [feedLogs, setFeedLogs] = useState<AmazonFeedLog[]>([]);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPageInput, setJumpPageInput] = useState('');

  const isZh = uiLang === 'zh';

  useEffect(() => {
    loadProducts();
    setFeedLogs(getStoredFeedLogs());
  }, []);

  const loadProducts = () => {
    const list = getStoredAmazonProducts();
    // Filter out any foreign demo items (e.g., EARBUDS, DOG-HARNESS, BOSCH, CHARGER, BOTTLE, MOUSE, DIFFUSER)
    const demoKeywords = ['EARBUDS', 'NO-PULL-HARNESS', 'BOSCH-', 'WIRELESS-CHARGER', 'HYDRO-BOTTLE', 'ERGO-OPTICAL', 'AROMA-DIFFUSER'];
    const cleaned = list.filter(p => !demoKeywords.some(kw => (p.sku && p.sku.includes(kw)) || (p.id && p.id.includes(kw))));
    
    if (cleaned.length !== list.length) {
      saveStoredAmazonProducts(cleaned);
      setProducts(cleaned);
    } else {
      setProducts(list);
    }

    // Auto-expand all families by default for convenient browsing
    const initialGroups = new Set<string>();
    (cleaned.length > 0 ? cleaned : list).forEach(p => {
      if (p.parent_asin || p.parent_sku) {
        initialGroups.add(p.parent_asin || p.parent_sku || '');
      }
    });
    setExpandedGroupIds(initialGroups);
  };

  const handleResetToMyProducts = () => {
    if (confirm(isZh ? '确认清理所有非本店/演示商品，仅保留您自己上架的 12 个瑜伽裤单品变体？' : 'Reset and keep only your 12 authentic listings?')) {
      const list = getStoredAmazonProducts();
      const demoKeywords = ['EARBUDS', 'NO-PULL-HARNESS', 'BOSCH-', 'WIRELESS-CHARGER', 'HYDRO-BOTTLE', 'ERGO-OPTICAL', 'AROMA-DIFFUSER'];
      const cleaned = list.filter(p => !demoKeywords.some(kw => (p.sku && p.sku.includes(kw)) || (p.id && p.id.includes(kw))));
      saveStoredAmazonProducts(cleaned);
      setProducts(cleaned);
      setSelectedIds(new Set());
      setSyncNotice(isZh ? '已成功清理非本店商品，当前仅保留您真实上架的商品！' : 'Successfully cleaned up demo items!');
      setTimeout(() => setSyncNotice(null), 4000);
    }
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
      
      // Auto-expand newly synced variation groups
      const syncedGroups = new Set<string>();
      res.items.forEach(p => {
        if (p.parent_asin || p.parent_sku) {
          syncedGroups.add(p.parent_asin || p.parent_sku || '');
        }
      });
      setExpandedGroupIds(syncedGroups);
      setCurrentPage(1);

      setSyncNotice(
        isZh 
          ? `成功同步 ${res.count} 个亚马逊商品/变体！数据已自动识别父子变体关系与真实在售 (Active) 状态。` 
          : `Successfully synced ${res.count} listings/variants from Amazon SP-API!`
      );
      setTimeout(() => setSyncNotice(null), 6000);
    } catch (err: any) {
      alert(err.message || (isZh ? '同步商品失败' : 'Failed to sync listings'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = (id: string) => {
    const updated = deleteStoredAmazonProduct(id);
    setProducts(updated);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleConfirmBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const current = getStoredAmazonProducts();
    const updated = current.filter(p => !selectedIds.has(p.id));
    saveStoredAmazonProducts(updated);
    setProducts(updated);
    setSelectedIds(new Set());
    setBatchDeleteModalOpen(false);
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

  const handleSaveListingFromModal = (updatedProduct: AmazonProduct) => {
    const current = getStoredAmazonProducts();
    const updated = current.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    saveStoredAmazonProducts(updated);
    setProducts(updated);
    setEditingProduct(null);
  };

  // Filter products based on search & filters
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
        p.sku.toLowerCase().includes(q) ||
        p.asin.toLowerCase().includes(q) ||
        (p.parent_asin && p.parent_asin.toLowerCase().includes(q)) ||
        (p.parent_sku && p.parent_sku.toLowerCase().includes(q)) ||
        p.title.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.variation_name && p.variation_name.toLowerCase().includes(q)) ||
        (p.color_name && p.color_name.toLowerCase().includes(q)) ||
        (p.size_name && p.size_name.toLowerCase().includes(q));
      
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesMarketplace = marketplaceFilter === 'ALL' || p.marketplace === marketplaceFilter;
      const matchesFulfillment = fulfillmentFilter === 'ALL' || p.fulfillment_channel === fulfillmentFilter;
      
      let matchesVariation = true;
      if (variationFilter === 'PARENT') {
        matchesVariation = Boolean(p.parent_asin || p.parent_sku);
      } else if (variationFilter === 'SINGLE') {
        matchesVariation = !p.parent_asin && !p.parent_sku;
      }

      return matchesSearch && matchesStatus && matchesMarketplace && matchesFulfillment && matchesVariation;
    });
  }, [products, searchTerm, statusFilter, marketplaceFilter, fulfillmentFilter, variationFilter]);

  // Group filtered products into Parent Families vs Single Items
  const productGroups = useMemo<ProductGroup[]>(() => {
    const groupMap = new Map<string, ProductGroup>();

    filteredProducts.forEach(p => {
      const key = p.parent_asin || p.parent_sku || `single-${p.id}`;
      if (!groupMap.has(key)) {
        // Strip trailing variation details from parent display title
        const cleanTitle = p.title.replace(/\s*\([^)]*(?:Small|Medium|Large|XL|XS|Black|White|Blue|Red|Green|Navy|Inch|cm|\/)[^)]*\)\s*$/i, '').trim() || p.title;

        groupMap.set(key, {
          groupId: key,
          isFamily: Boolean(p.parent_asin || p.parent_sku),
          parentAsin: p.parent_asin,
          parentSku: p.parent_sku,
          variationTheme: p.variation_theme || (p.parent_asin ? 'Color-Size' : undefined),
          title: cleanTitle,
          brand: p.brand,
          marketplace: p.marketplace,
          mainImage: p.main_image,
          children: [],
          minPrice: p.price,
          maxPrice: p.price,
          totalQuantity: 0,
          currency: p.currency || 'USD',
          allFba: true,
          allFbm: true,
          hasActive: false,
          hasDraft: false
        });
      }

      const group = groupMap.get(key)!;
      group.children.push(p);
      group.minPrice = Math.min(group.minPrice, p.price);
      group.maxPrice = Math.max(group.maxPrice, p.price);
      group.totalQuantity += (p.quantity || 0);
      if (p.fulfillment_channel !== 'FBA') group.allFba = false;
      if (p.fulfillment_channel !== 'FBM') group.allFbm = false;
      if (p.status === 'Active') group.hasActive = true;
      if (p.status === 'Draft' || p.status === 'Syncing') group.hasDraft = true;
      if (!group.mainImage && p.main_image) group.mainImage = p.main_image;
    });

    return Array.from(groupMap.values());
  }, [filteredProducts]);

  // Pagination calculation
  const totalItemCount = viewMode === 'hierarchy' ? productGroups.length : filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItemCount / pageSize));

  // Auto adjust page when out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const pagedGroups = useMemo(() => {
    if (viewMode !== 'hierarchy') return [];
    const start = (currentPage - 1) * pageSize;
    return productGroups.slice(start, start + pageSize);
  }, [productGroups, currentPage, pageSize, viewMode]);

  const pagedFlatProducts = useMemo(() => {
    if (viewMode !== 'flat') return [];
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize, viewMode]);

  // Expand / Collapse group toggles
  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const all = new Set<string>(productGroups.map(g => g.groupId));
    setExpandedGroupIds(all);
  };

  const handleCollapseAll = () => {
    setExpandedGroupIds(new Set());
  };

  // Group selection toggle
  const toggleGroupSelection = (group: ProductGroup, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      group.children.forEach(c => {
        if (checked) next.add(c.id);
        else next.delete(c.id);
      });
      return next;
    });
  };

  const isGroupSelected = (group: ProductGroup) => {
    if (group.children.length === 0) return false;
    return group.children.every(c => selectedIds.has(c.id));
  };

  const isGroupPartiallySelected = (group: ProductGroup) => {
    const selectedChildCount = group.children.filter(c => selectedIds.has(c.id)).length;
    return selectedChildCount > 0 && selectedChildCount < group.children.length;
  };

  const handleSelectAllOnCurrentPage = (checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const itemsToToggle = viewMode === 'hierarchy' 
        ? pagedGroups.flatMap(g => g.children) 
        : pagedFlatProducts;
      
      itemsToToggle.forEach(p => {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
  };

  // Metrics
  const activeCount = products.filter(p => p.status === 'Active').length;
  const fbaCount = products.filter(p => p.fulfillment_channel === 'FBA').length;
  const variationFamiliesCount = useMemo(() => {
    const parentKeys = new Set<string>();
    products.forEach(p => {
      if (p.parent_asin || p.parent_sku) {
        parentKeys.add(p.parent_asin || p.parent_sku || '');
      }
    });
    return parentKeys.size;
  }, [products]);

  const currencySymbol = (curr: string) => {
    switch (curr) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      case 'CAD': return 'CA$';
      case 'AUD': return 'AU$';
      default: return '$';
    }
  };

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
                  SP-API
                </span>
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {isZh ? '支持多品类父子变体层级管理、在线库存监控、全属性 Listing 编辑与 SP-API 一键同步' : 'Manage multi-variant parent-child catalog, full attributes editor & stock via SP-API'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={handleResetToMyProducts}
            title={isZh ? '清理非本店或测试商品，保留本人上架商品' : 'Clean foreign demo listings'}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200/60"
          >
            <Trash2 size={14} className="text-slate-400 group-hover:text-rose-500" />
            {isZh ? '清理非本店商品' : 'Purge Demo Items'}
          </button>

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
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
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
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isZh ? '商品/变体总数' : 'Total Variants'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{products.length}</span>
            <span className="text-xs font-bold text-slate-400">{isZh ? '个 SKU' : 'SKUs'}</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">{isZh ? '父体商品族数' : 'Parent Families'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">{variationFamiliesCount}</span>
            <Boxes size={18} className="text-amber-500" />
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
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{isZh ? 'FBA 亚马逊配送' : 'FBA Fulfilled'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-600">{fbaCount}</span>
            <Zap size={18} className="text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative w-full lg:w-96">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={isZh ? "搜索 SKU、ASIN、父体 ASIN、标题、品牌、颜色尺码..." : "Search SKU, ASIN, Parent ASIN, Title, Brand..."}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  viewMode === 'hierarchy' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers size={13} />
                {isZh ? '父子层级视图' : 'Hierarchy View'}
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  viewMode === 'flat' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List size={13} />
                {isZh ? '平铺明细视图' : 'Flat List'}
              </button>
            </div>

            {/* Expand / Collapse Buttons for Hierarchy Mode */}
            {viewMode === 'hierarchy' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExpandAll}
                  title={isZh ? "展开所有父体变体" : "Expand All"}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all"
                >
                  {isZh ? '全部展开' : 'Expand All'}
                </button>
                <button
                  onClick={handleCollapseAll}
                  title={isZh ? "折叠所有父体变体" : "Collapse All"}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all"
                >
                  {isZh ? '全部折叠' : 'Collapse All'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Selectors */}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold">
            <Filter size={13} />
            <span>{isZh ? '筛选:' : 'Filter:'}</span>
          </div>

          <select 
            value={variationFilter}
            onChange={(e) => { setVariationFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '商品属性: 全部商品' : 'All Product Types'}</option>
            <option value="PARENT">{isZh ? '仅变体商品族 (Parent/Child)' : 'Variation Families Only'}</option>
            <option value="SINGLE">{isZh ? '仅单品无变体 (Single)' : 'Single Items Only'}</option>
          </select>

          <select 
            value={marketplaceFilter}
            onChange={(e) => { setMarketplaceFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
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
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '全部状态 (All Status)' : 'All Status'}</option>
            <option value="Active">{isZh ? '在售在线 (Active)' : 'Active'}</option>
            <option value="Draft">{isZh ? '草稿/待同步 (Draft)' : 'Draft'}</option>
            <option value="Inactive">{isZh ? '下架 (Inactive)' : 'Inactive'}</option>
            <option value="Error">{isZh ? '异常 (Error)' : 'Error'}</option>
          </select>

          <select 
            value={fulfillmentFilter}
            onChange={(e) => { setFulfillmentFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '全部配送方式' : 'All Fulfillment'}</option>
            <option value="FBA">FBA (亚马逊配送)</option>
            <option value="FBM">FBM (卖家自发货)</option>
          </select>

          {selectedIds.size > 0 && (
            <button 
              onClick={() => setBatchDeleteModalOpen(true)}
              className="ml-auto px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 size={13} /> {isZh ? `从本地列表移除 (${selectedIds.size})` : `Remove (${selectedIds.size})`}
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
                  ? (isZh ? '点击右上角【从亚马逊同步商品】快速载入多变体库存，或点击【从产品库发布】将优化好的商品推送到亚马逊。' : 'Click "Sync from Amazon" to import multi-variant catalog.')
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
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-4 px-5 w-12 text-center">
                    <input 
                      type="checkbox"
                      checked={
                        viewMode === 'hierarchy'
                          ? pagedGroups.length > 0 && pagedGroups.every(g => isGroupSelected(g))
                          : pagedFlatProducts.length > 0 && pagedFlatProducts.every(p => selectedIds.has(p.id))
                      }
                      onChange={(e) => handleSelectAllOnCurrentPage(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                  </th>
                  <th className="py-4 px-3 w-16">{isZh ? '主图' : 'Image'}</th>
                  <th className="py-4 px-4">{isZh ? '商品信息 (父体 / SKU / ASIN / 标题)' : 'Product Details'}</th>
                  <th className="py-4 px-4">{isZh ? '站点' : 'Market'}</th>
                  <th className="py-4 px-4">{isZh ? '售价区间' : 'Price'}</th>
                  <th className="py-4 px-4">{isZh ? '库存' : 'Stock'}</th>
                  <th className="py-4 px-4">{isZh ? '配送' : 'Fulfillment'}</th>
                  <th className="py-4 px-4">{isZh ? '状态' : 'Status'}</th>
                  <th className="py-4 px-5 text-right">{isZh ? '操作' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {/* 1. HIERARCHY VIEW: PARENT & CHILD TREE */}
                {viewMode === 'hierarchy' && pagedGroups.map((group) => {
                  const isExpanded = expandedGroupIds.has(group.groupId);
                  const isSelected = isGroupSelected(group);
                  const isPartially = isGroupPartiallySelected(group);

                  return (
                    <React.Fragment key={group.groupId}>
                      {/* Parent / Summary Row */}
                      <tr className={`border-b border-slate-100 transition-colors ${
                        group.isFamily 
                          ? (isExpanded ? 'bg-amber-50/20' : 'bg-white hover:bg-slate-50/70') 
                          : 'bg-white hover:bg-slate-50/70'
                      }`}>
                        <td className="py-4 px-5 text-center">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            ref={input => {
                              if (input) input.indeterminate = isPartially;
                            }}
                            onChange={(e) => toggleGroupSelection(group, e.target.checked)}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                          />
                        </td>

                        <td className="py-4 px-3">
                          <div className="relative w-12 h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center shadow-xs">
                            {group.mainImage ? (
                              <img src={group.mainImage} alt={group.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Package size={20} className="text-slate-300" />
                            )}
                            {group.isFamily && (
                              <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[9px] font-black px-1 rounded-tl-md">
                                {group.children.length}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4 max-w-md">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              {group.isFamily ? (
                                <button 
                                  onClick={() => toggleGroupExpand(group.groupId)}
                                  className="flex items-center gap-1 text-amber-600 hover:text-amber-700 font-black text-xs group/btn"
                                >
                                  {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <Boxes size={11} />
                                    {isZh ? `父体商品 (${group.children.length} 个变体)` : `Parent (${group.children.length} Vars)`}
                                  </span>
                                </button>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black uppercase">
                                  {isZh ? '单品 (Single Item)' : 'Single Item'}
                                </span>
                              )}

                              {group.variationTheme && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                                  {group.variationTheme}
                                </span>
                              )}
                            </div>

                            <p className="font-bold text-slate-900 line-clamp-1 text-sm" title={group.title}>
                              {group.title}
                            </p>

                            <div className="flex items-center gap-2.5 text-[11px] text-slate-400 flex-wrap">
                              {group.parentAsin && (
                                <span className="font-mono text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                                  Parent ASIN: {group.parentAsin}
                                </span>
                              )}
                              {group.parentSku && (
                                <span className="font-mono text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                  Parent SKU: {group.parentSku}
                                </span>
                              )}
                              {group.brand && <span>{group.brand}</span>}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {group.marketplace}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-black text-slate-900 text-sm">
                            {currencySymbol(group.currency)}
                            {group.minPrice === group.maxPrice 
                              ? group.minPrice.toFixed(2) 
                              : `${group.minPrice.toFixed(2)} - ${group.maxPrice.toFixed(2)}`}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 text-sm">
                              {group.totalQuantity}
                            </span>
                            {group.isFamily && (
                              <span className="text-[10px] text-slate-400 block font-semibold">
                                {isZh ? '汇总总库存' : 'Total stock'}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            group.allFba 
                              ? 'bg-indigo-50 text-indigo-700' 
                              : group.allFbm 
                              ? 'bg-slate-100 text-slate-600' 
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {group.allFba ? 'FBA' : group.allFbm ? 'FBM' : 'FBA+FBM'}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              group.hasActive ? 'bg-emerald-500' : 'bg-amber-500'
                            }`} />
                            <span className="font-bold text-xs">
                              {group.hasActive ? 'Active (在售)' : 'Draft'}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {group.isFamily ? (
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => toggleGroupExpand(group.groupId)}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  {isExpanded ? (isZh ? '收起' : 'Hide') : (isZh ? `展开 (${group.children.length})` : 'View Vars')}
                                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                                <button 
                                  onClick={() => setEditingProduct(group.children[0])}
                                  title={isZh ? "编辑首个变体" : "Edit First Variant"}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handlePushSingle(group.children[0])}
                                  title={isZh ? "通过 SP-API 推送/更新至亚马逊" : "Push to Amazon"}
                                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                >
                                  <Zap size={14} />
                                </button>
                                <button 
                                  onClick={() => setEditingProduct(group.children[0])}
                                  title={isZh ? "后台式全属性编辑商品" : "Edit Listing Attributes"}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(group.children[0].id)}
                                  title={isZh ? "从本地列表移除 (不影响亚马逊后台)" : "Remove from local list"}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Child Variation Rows (Nested under Parent) */}
                      {group.isFamily && isExpanded && group.children.map((child, idx) => {
                        const isChildSelected = selectedIds.has(child.id);
                        const isLastChild = idx === group.children.length - 1;

                        return (
                          <tr 
                            key={child.id} 
                            className={`bg-slate-50/40 hover:bg-amber-50/40 transition-colors border-b border-slate-100/60 ${
                              isChildSelected ? 'bg-amber-50/50' : ''
                            }`}
                          >
                            <td className="py-3 px-5 text-center">
                              <input 
                                type="checkbox"
                                checked={isChildSelected}
                                onChange={(e) => {
                                  setSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(child.id);
                                    else next.delete(child.id);
                                    return next;
                                  });
                                }}
                                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                              />
                            </td>

                            <td className="py-3 px-3">
                              <div className="w-9 h-9 ml-3 bg-white rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                                {child.main_image ? (
                                  <img src={child.main_image} alt={child.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Package size={16} className="text-slate-300" />
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 max-w-md">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-slate-300 font-mono text-xs select-none">
                                    {isLastChild ? '└──' : '├──'}
                                  </span>

                                  {child.variation_name ? (
                                    <span className="px-2 py-0.5 bg-amber-100/80 text-amber-900 rounded-md font-black text-[11px]">
                                      {child.variation_name}
                                    </span>
                                  ) : child.variation_values ? (
                                    Object.entries(child.variation_values).map(([k, v]) => (
                                      <span key={k} className="px-2 py-0.5 bg-amber-100/80 text-amber-900 rounded-md font-black text-[11px]">
                                        {k}: {v}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-bold text-[10px]">
                                      {isZh ? `子变体 #${idx + 1}` : `Var #${idx + 1}`}
                                    </span>
                                  )}

                                  <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                                    SKU: {child.sku}
                                  </span>

                                  {child.asin && (
                                    <a 
                                      href={`https://www.amazon.com/dp/${child.asin}`} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="font-mono text-amber-600 hover:text-amber-700 flex items-center gap-0.5 hover:underline text-[10px]"
                                    >
                                      ASIN: {child.asin} <ExternalLink size={9} />
                                    </a>
                                  )}
                                </div>

                                <p className="text-slate-600 font-medium text-xs line-clamp-1 pl-6" title={child.title}>
                                  {child.title}
                                </p>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="text-[11px] text-slate-500 font-bold">
                                {child.marketplace}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-black text-slate-900 text-xs">
                                {currencySymbol(child.currency)}{child.price.toFixed(2)}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`font-bold text-xs ${child.quantity <= 5 ? 'text-red-500' : 'text-slate-700'}`}>
                                {child.quantity}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                child.fulfillment_channel === 'FBA' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {child.fulfillment_channel}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  child.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'
                                }`} />
                                <span className="text-xs font-semibold text-slate-700">
                                  {child.status === 'Active' ? 'Active (在售)' : child.status}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => handlePushSingle(child)}
                                  title={isZh ? "通过 SP-API 推送/更新子变体" : "Push Variant"}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                >
                                  <Zap size={13} />
                                </button>
                                <button 
                                  onClick={() => setEditingProduct(child)}
                                  title={isZh ? "后台式全属性编辑子变体" : "Edit Variant Attributes"}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(child.id)}
                                  title={isZh ? "从本地列表移除 (不影响亚马逊后台)" : "Remove from local list"}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* 2. FLAT VIEW: EVERY LISTING INDIVIDUALLY */}
                {viewMode === 'flat' && pagedFlatProducts.map(p => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-amber-50/30' : ''}`}>
                      <td className="py-4 px-5 text-center">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            });
                          }}
                          className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                        />
                      </td>

                      <td className="py-4 px-3">
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
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-400 flex-wrap">
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
                            {p.variation_name && (
                              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                {p.variation_name}
                              </span>
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
                          {currencySymbol(p.currency)}{p.price.toFixed(2)}
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
                            p.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`} />
                          <span className="font-bold text-xs">
                            {p.status === 'Active' ? 'Active (在售)' : p.status}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handlePushSingle(p)}
                            title={isZh ? "通过 SP-API 推送/更新" : "Push"}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          >
                            <Zap size={15} />
                          </button>
                          <button 
                            onClick={() => setEditingProduct(p)}
                            title={isZh ? "后台式全属性编辑商品" : "Edit Listing Attributes"}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => handleDelete(p.id)}
                            title={isZh ? "从本地列表移除" : "Delete"}
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

        {/* Complete Pagination Controls Bar */}
        {filteredProducts.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            {/* Left: Summary Info */}
            <div className="text-slate-500 font-medium">
              {isZh ? (
                <span>
                  共 <strong className="text-slate-900 font-black">{filteredProducts.length}</strong> 个商品/变体
                  {viewMode === 'hierarchy' && ` (归纳为 ${productGroups.length} 个商品族/系列)`}，
                  当前显示第 <strong className="text-slate-900 font-black">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItemCount)}</strong> 项
                </span>
              ) : (
                <span>
                  Showing <strong>{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItemCount)}</strong> of <strong>{totalItemCount}</strong> items
                </span>
              )}
            </div>

            {/* Right: Page Nav & Page Size Selector */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* Page size dropdown */}
              <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                <span>{isZh ? '每页显示:' : 'Page size:'}</span>
                <select 
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {PAGE_SIZES.map(s => (
                    <option key={s} value={s}>{s} {isZh ? '条/页' : '/ page'}</option>
                  ))}
                </select>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title={isZh ? "首页" : "First Page"}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  title={isZh ? "上一页" : "Previous Page"}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  title={isZh ? "下一页" : "Next Page"}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title={isZh ? "末页" : "Last Page"}
                  className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>

              {/* Jump to page */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    min={1} 
                    max={totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    placeholder={String(currentPage)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = parseInt(jumpPageInput);
                        if (target >= 1 && target <= totalPages) {
                          setCurrentPage(target);
                          setJumpPageInput('');
                        }
                      }
                    }}
                    className="w-12 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const target = parseInt(jumpPageInput);
                      if (target >= 1 && target <= totalPages) {
                        setCurrentPage(target);
                        setJumpPageInput('');
                      }
                    }}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs"
                  >
                    {isZh ? '跳转' : 'Go'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full Amazon Seller Central Style Listing Editor Modal */}
      {editingProduct && (
        <AmazonListingDetailModal
          product={editingProduct}
          uiLang={uiLang}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveListingFromModal}
          onDelete={handleDelete}
        />
      )}

      {/* Batch Delete / Remove from Local Cache Confirmation Modal */}
      {batchDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {isZh ? `确认从本地列表移除 ${selectedIds.size} 个商品？` : `Remove ${selectedIds.size} items?`}
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  {isZh ? '本地 ERP 缓存清理确认' : 'Local ERP Cache Cleanup'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>{isZh ? '安全保障说明：' : 'Safety Guarantee:'}</span>
              </div>
              <p className="leading-relaxed">
                {isZh 
                  ? '【从本地列表移除】仅会从当前系统的管理列表中清理选中商品的缓存记录，' 
                  : 'This will only clear the local cached listings in ERP.'}
                <strong className="text-slate-900 font-black">
                  {isZh ? '绝对不会在亚马逊卖家后台执行下架或删除操作。' : ' Your live Amazon store listings will NOT be deleted.'}
                </strong>
              </p>
              <p className="text-slate-400 text-[11px]">
                {isZh ? '如需重新查看这些商品，随时可以在右上角点击【从亚马逊同步商品】重新拉取。' : 'You can sync them back anytime.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setBatchDeleteModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmBatchDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs shadow-md"
              >
                {isZh ? '确认从本地清除' : 'Confirm Clean'}
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
