
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, CheckCircle, Trash2, Download, Package, 
  Loader2, Globe, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Languages, MoreHorizontal, Calendar, PackageOpen, RefreshCcw, Tags, ExternalLink, Edit3, DollarSign, Copy, Sparkles
} from 'lucide-react';
import { Listing, UILanguage, Category, UserProfile, OptimizedData } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { ManualListingModal } from './ManualListingModal';
import { ExportModal } from './ExportModal';
import { MARKETPLACES } from '../lib/marketplaces';
import { checkUserCredits, deductCreditsByTokens } from '../lib/creditService';
import { optimizeListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI } from '../services/openaiService';
import { optimizeListingWithDeepSeek } from '../services/deepseekService';
import { translateListingWithAI } from '../services/geminiService';
import { translateListingWithOpenAI } from '../services/openaiService';
import { translateListingWithDeepSeek } from '../services/deepseekService';
import { calculateMarketLogistics, calculateMarketPrice } from './LogisticsEditor';

interface ListingsManagerProps {
  onSelectListing: (listing: Listing) => void;
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
  lang: UILanguage;
  refreshListings: () => void;
  isInitialLoading?: boolean;
  userProfile?: UserProfile | null;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterMarketplace: string;
  setFilterMarketplace: (val: string) => void;
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  currentPage: number;
  setCurrentPage: (val: number | ((prev: number) => number)) => void;
  itemsPerPage: number;
  setItemsPerPage: (val: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

export const ListingsManager: React.FC<ListingsManagerProps> = ({ 
  onSelectListing, 
  listings = [], 
  setListings, 
  lang, 
  refreshListings,
  isInitialLoading,
  userProfile,
  searchTerm,
  setSearchTerm,
  filterMarketplace,
  setFilterMarketplace,
  filterCategory,
  setFilterCategory,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  setItemsPerPage
}) => {
  const t = useTranslation(lang);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchAIProcessing, setIsBatchAIProcessing] = useState(false);
  const [batchAIProgress, setBatchAIProgress] = useState({ current: 0, total: 0 });
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [rates, setRates] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    if (!isSupabaseConfigured()) return;
    const [rRes, aRes] = await Promise.all([
      supabase.from('exchange_rates').select('*'),
      supabase.from('price_adjustments').select('*')
    ]);
    if (rRes.data) setRates(rRes.data);
    if (aRes.data) setAdjustments(aRes.data);
  };

  const fetchCategories = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data } = await supabase.from('categories').select('*');
      if (data && Array.isArray(data)) setCategories(data);
    } catch (e) {
      console.warn("Failed to fetch categories:", e);
    }
  };

  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCurrentPage(1);
  }, [searchTerm, filterMarketplace, filterCategory, itemsPerPage]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(lang === 'zh' ? "确定要删除此产品吗？" : "Are you sure?")) return;
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (!error) refreshListings();
  };

  const handleBulkUpdateCategory = async (catId: string) => {
    if (selectedIds.size === 0 || !catId) return;
    setIsBatchUpdating(true);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ category_id: catId === 'NONE' ? null : catId })
        .in('id', Array.from(selectedIds));
      
      if (!error) {
        setSelectedIds(new Set());
        setBatchCategoryId(''); 
        refreshListings();
      }
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(lang === 'zh' ? `确定删除 ${selectedIds.size} 个产品？` : "Delete selected?")) return;
    setIsBatchDeleting(true);
    try {
      const { error } = await supabase.from('listings').delete().in('id', Array.from(selectedIds));
      if (!error) {
        setSelectedIds(new Set());
        refreshListings();
      }
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBulkOptimize = async () => {
    if (selectedIds.size === 0 || !userProfile) return;
    if (!window.confirm(lang === 'zh' ? `确定对选中的 ${selectedIds.size} 个产品进行 AI 优化？` : `Optimize ${selectedIds.size} listings with AI?`)) return;
    
    setIsBatchAIProcessing(true);
    const selectedListings = listings.filter(l => selectedIds.has(l.id));
    setBatchAIProgress({ current: 0, total: selectedListings.length });
    
    const engine = (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini';

    try {
      for (let i = 0; i < selectedListings.length; i++) {
        const listing = selectedListings[i];
        setBatchAIProgress({ current: i + 1, total: selectedListings.length });

        try {
          // 1. Pre-check credits
          const creditRes = await checkUserCredits(userProfile.id);
          if (!creditRes.success) {
            alert(lang === 'zh' ? `积分不足: ${creditRes.message}` : creditRes.message);
            break;
          }

          // 2. Perform AI optimization
          const { data: opt, tokens } = engine === 'openai' 
            ? await optimizeListingWithOpenAI(listing.cleaned) 
            : engine === 'deepseek' 
              ? await optimizeListingWithDeepSeek(listing.cleaned) 
              : await optimizeListingWithAI(listing.cleaned);

          // 3. Deduct credits based on tokens
          await deductCreditsByTokens(userProfile.id, tokens, engine, 'optimization');

          // 4. Update DB
          await supabase.from('listings').update({
            optimized: { 
              ...opt, 
              optimized_main_image: listing.optimized?.optimized_main_image, 
              optimized_other_images: listing.optimized?.optimized_other_images 
            }, 
            status: 'optimized',
            updated_at: new Date().toISOString()
          }).eq('id', listing.id);

        } catch (err) {
          console.error(`Failed to optimize listing ${listing.id}:`, err);
        }
      }
      refreshListings();
      setSelectedIds(new Set());
    } finally {
      setIsBatchAIProcessing(false);
    }
  };

  const handleBulkTranslate = async () => {
    if (selectedIds.size === 0 || !userProfile) return;
    if (!window.confirm(lang === 'zh' ? `确定对选中的 ${selectedIds.size} 个产品进行全站点 AI 翻译？` : `Translate ${selectedIds.size} listings for all markets?`)) return;
    
    setIsBatchAIProcessing(true);
    const selectedListings = listings.filter(l => selectedIds.has(l.id));
    setBatchAIProgress({ current: 0, total: selectedListings.length });
    
    const engine = (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini';
    const excludedCodes = ['US', 'ZY_ERP', 'MKD', 'OZON', 'TIKTOK'];
    const marketsToTranslate = MARKETPLACES.filter(m => !excludedCodes.includes(m.code));

    try {
      for (let i = 0; i < selectedListings.length; i++) {
        const listing = selectedListings[i];
        if (!listing.optimized) continue; // Skip if not optimized

        setBatchAIProgress({ current: i + 1, total: selectedListings.length });

        try {
          let currentTrans = { ...(listing.translations || {}) };

          for (const m of marketsToTranslate) {
            // Check if we already have a translation for this language
            const existingTrans = Object.entries(currentTrans).find(([mCode]) => {
              const mkt = MARKETPLACES.find(mkt => mkt.code === mCode);
              return mkt && mkt.langName === m.langName;
            });

            let translation;
            if (existingTrans) {
              translation = existingTrans[1];
            } else {
              // 1. Pre-check credits
              const creditRes = await checkUserCredits(userProfile.id);
              if (!creditRes.success) break;

              let tokens = 0;
              if (engine === 'openai') {
                const res = await translateListingWithOpenAI(listing.optimized, m.langName);
                translation = res.data;
                tokens = res.tokens;
              } else if (engine === 'deepseek') {
                const res = await translateListingWithDeepSeek(listing.optimized, m.langName);
                translation = res.data;
                tokens = res.tokens;
              } else {
                const res = await translateListingWithAI(listing.optimized, m.langName);
                translation = res.data;
                tokens = res.tokens;
              }

              await deductCreditsByTokens(userProfile.id, tokens, engine, 'translation');
            }

            const logistics = calculateMarketLogistics(listing, m.code);
            const priceData = calculateMarketPrice(listing, m.code, rates, adjustments);
            currentTrans[m.code] = { ...listing.optimized, ...translation, ...logistics, ...priceData } as OptimizedData;
          }

          // Update DB
          await supabase.from('listings').update({
            translations: currentTrans,
            updated_at: new Date().toISOString()
          }).eq('id', listing.id);

        } catch (err) {
          console.error(`Failed to translate listing ${listing.id}:`, err);
        }
      }
      refreshListings();
      setSelectedIds(new Set());
    } finally {
      setIsBatchAIProcessing(false);
    }
  };

  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    return listings.filter(l => {
      if (!l) return false;
      // 这里的 cleaned 检查过于严格，如果数据库里有数据但 cleaned 为空，会导致不显示。
      // 即使 cleaned 为空，我们也应该显示 ASIN 等基础信息。
      const displayTitle = (l.status === 'optimized' && l.optimized?.optimized_title) 
        ? l.optimized.optimized_title 
        : (l.cleaned?.title || "Untitled Listing");
      
      const safeTitle = String(displayTitle).toLowerCase();
      const safeAsin = String(l.asin || "").toLowerCase();
      const safeSearch = String(searchTerm).toLowerCase();

      const matchesSearch = safeTitle.includes(safeSearch) || safeAsin.includes(safeSearch);
      const matchesMarketplace = filterMarketplace === 'ALL' || l.marketplace === filterMarketplace;
      const matchesCategory = filterCategory === 'ALL' || l.category_id === (filterCategory === 'NONE' ? null : filterCategory);
      
      return matchesSearch && matchesMarketplace && matchesCategory;
    });
  }, [listings, searchTerm, filterMarketplace, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / (itemsPerPage || 20)));
  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredListings.slice(start, start + itemsPerPage);
  }, [filteredListings, currentPage, itemsPerPage]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedListings.length && paginatedListings.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedListings.filter(l => l && l.id).map(l => l.id)));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const getAmazonUrl = (asin: string, mktCode: string) => {
    const mkt = MARKETPLACES.find(m => m.code === mktCode);
    if (!mkt || !mkt.domain) return null;
    const domain = mkt.domain;
    return `https://${domain}/dp/${asin}`;
  };

  const renderDistributionStatus = (listing: Listing) => {
    if (!listing) return null;
    const translations = listing.translations ? Object.keys(listing.translations) : [];
    const exports = listing.exported_marketplaces || [];
    return (
      <div className="flex flex-col gap-2">
        {translations.length > 0 && (
          <div className="flex items-center gap-1.5" title="Translated Markets">
            <Languages size={10} className="text-purple-400" />
            <div className="flex -space-x-1.5">
              {translations.slice(0, 4).map(code => (
                <span key={code} className="text-xs grayscale-[0.3]" title={code}>
                  {MARKETPLACES.find(m => m.code === code)?.flag || '🏳️'}
                </span>
              ))}
              {translations.length > 4 && <span className="text-[8px] font-black text-slate-300 pl-1">+{translations.length - 4}</span>}
            </div>
          </div>
        )}
        {exports.length > 0 && (
          <div className="flex items-center gap-1.5" title="Exported Markets">
            <Download size={10} className="text-emerald-400" />
            <div className="flex -space-x-1.5">
              {exports.slice(0, 4).map(code => (
                <span key={code} className="text-xs drop-shadow-sm" title={`Exported to ${code}`}>
                  {MARKETPLACES.find(m => m.code === code)?.flag || '🏳️'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {isManualModalOpen && <ManualListingModal uiLang={lang} orgId={userProfile?.org_id || ''} onClose={() => setIsManualModalOpen(false)} onSave={() => { setIsManualModalOpen(false); refreshListings(); }} />}
      {isExportModalOpen && <ExportModal uiLang={lang} selectedListings={listings.filter(l => selectedIds.has(l.id))} onClose={() => setIsExportModalOpen(false)} onExportSuccess={refreshListings} />}
      
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{t('listings')}</h2>
        <p className="text-slate-400 font-medium text-sm">Manage inventory and global distribution targets.</p>
      </div>
      
      <div className="flex flex-col xl:flex-row justify-between items-center gap-6">
        <div className="flex flex-1 flex-wrap gap-4 w-full">
          <div className="relative flex-1 min-w-[300px] group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder={t('searchPlaceholder')} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none font-bold text-sm shadow-sm transition-all" 
            />
          </div>
          <div className="relative min-w-[160px]">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
            <select value={filterMarketplace} onChange={(e) => setFilterMarketplace(e.target.value)} className="w-full pl-12 pr-8 py-4 bg-white border border-slate-200 rounded-3xl font-black text-[10px] uppercase tracking-widest outline-none shadow-sm cursor-pointer appearance-none">
              <option value="ALL">All Sites</option>
              {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.code}</option>)}
            </select>
          </div>
          <button 
            onClick={refreshListings} 
            disabled={isInitialLoading}
            className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCcw size={20} className={isInitialLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
           <div className={`flex gap-2 items-center bg-indigo-50 px-5 py-2 rounded-[2rem] border border-indigo-100 transition-opacity ${selectedIds.size === 0 ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
              <span className="text-[10px] font-black text-indigo-600 uppercase">Batch:</span>
              <select 
                value={batchCategoryId}
                onChange={(e) => {
                  setBatchCategoryId(e.target.value);
                  handleBulkUpdateCategory(e.target.value);
                }} 
                className="bg-white border border-indigo-200 rounded-xl text-[10px] font-black px-3 py-1.5 outline-none"
              >
                <option value="">Move to...</option>
                <option value="NONE">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="w-px h-4 bg-indigo-200 mx-2"></div>
              
              <button 
                onClick={handleBulkOptimize} 
                disabled={isBatchAIProcessing} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                title="AI Optimize Selected"
              >
                {isBatchAIProcessing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {lang === 'zh' ? 'AI 优化' : 'AI Optimize'}
              </button>

              <button 
                onClick={handleBulkTranslate} 
                disabled={isBatchAIProcessing} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                title="AI Translate Selected"
              >
                {isBatchAIProcessing ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                {lang === 'zh' ? 'AI 翻译' : 'AI Translate'}
              </button>

              <div className="w-px h-4 bg-indigo-200 mx-2"></div>

              <button onClick={handleBulkDelete} disabled={isBatchDeleting} className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all" title="Delete Selected">
                {isBatchDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
           </div>
           
           {isBatchAIProcessing && (
             <div className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-3xl shadow-xl animate-in slide-in-from-right-4">
               <Loader2 size={16} className="animate-spin" />
               <span className="text-[10px] font-black uppercase tracking-widest">
                 Processing {batchAIProgress.current} / {batchAIProgress.total}
               </span>
             </div>
           )}
           
           <button onClick={() => setIsExportModalOpen(true)} disabled={selectedIds.size === 0} className={`px-8 py-4 bg-indigo-600 text-white rounded-3xl hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-indigo-100 ${selectedIds.size === 0 ? 'opacity-40' : ''}`}>
             <Download size={16} /> {t('export')}
           </button>
           
           <button onClick={() => setIsManualModalOpen(true)} className="px-8 py-4 bg-slate-900 text-white rounded-3xl hover:bg-black font-black text-[10px] shadow-2xl transition-all uppercase tracking-widest">
            <Plus size={16} /> {t('manualAdd')}
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[9px] uppercase text-slate-400 font-black tracking-widest">
                <th className="p-8 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 cursor-pointer" 
                    checked={paginatedListings.length > 0 && paginatedListings.every(l => l && selectedIds.has(l.id))} 
                    onChange={toggleSelectAll} 
                  />
                </th>
                <th className="p-8 w-16 text-center">#</th>
                <th className="p-8">Image</th>
                <th className="p-8">Status</th>
                <th className="p-8">Category</th>
                <th className="p-8">ASIN</th>
                <th className="p-8">Price</th>
                <th className="p-8 w-1/4">Title</th>
                <th className="p-8 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isInitialLoading && paginatedListings.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="p-8 text-center">
                       <div className="flex items-center justify-center gap-3">
                         <Loader2 size={16} className="animate-spin text-indigo-500" />
                         <div className="h-6 bg-slate-50 rounded-lg w-1/2"></div>
                       </div>
                    </td>
                  </tr>
                ))
              ) : paginatedListings.map((listing, index) => {
                   if (!listing) return null;
                   
                   // 核心崩溃防护：强制将 price 转换为数字，防止字符串导致 toFixed(2) 报错
                   const rawPrice = (listing.status === 'optimized' && listing.optimized?.optimized_price !== undefined) 
                      ? listing.optimized.optimized_price 
                      : (listing.cleaned?.price || 0);
                   const price = Number(rawPrice) || 0;
                   
                   const title = (listing.status === 'optimized' && listing.optimized?.optimized_title) 
                      ? listing.optimized.optimized_title 
                      : (listing.cleaned?.title || "Untitled");
                   
                   const catName = categories.find(c => c.id === listing.category_id)?.name || '-';
                   const mkt = MARKETPLACES.find(m => m.code === listing.marketplace);
                   const sequenceNum = (currentPage - 1) * itemsPerPage + index + 1;
                   const asinUrl = getAmazonUrl(listing.asin || '', listing.marketplace || 'US');
                   
                   return (
                    <tr key={listing.id} className={`hover:bg-slate-50/50 transition-all group cursor-pointer ${selectedIds.has(listing.id) ? 'bg-indigo-50/20' : ''}`} onClick={() => onSelectListing(listing)}>
                      <td className="p-8 text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 cursor-pointer" checked={selectedIds.has(listing.id)} onChange={(e) => toggleSelectOne(listing.id, e as any)} />
                      </td>
                      <td className="p-8 text-center">
                        <span className="text-[10px] font-black text-slate-300">{sequenceNum}</span>
                      </td>
                      <td className="p-8">
                        <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center p-1">
                          <img src={listing.cleaned?.main_image || ''} className="max-w-full max-h-full object-contain" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Img')} />
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="space-y-2">
                          {listing.status === 'optimized' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-600 rounded-md text-[8px] font-black uppercase border border-green-100">Optimized</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-400 rounded-md text-[8px] font-black uppercase border border-slate-100">Collected</span>
                          )}
                          {renderDistributionStatus(listing)}
                        </div>
                      </td>
                      <td className="p-8">
                        <span className={`text-[10px] font-black uppercase ${listing.category_id ? 'text-indigo-600' : 'text-slate-300 italic'}`}>
                          {catName}
                        </span>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col gap-1">
                          {asinUrl ? (
                            <a 
                              href={asinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 group/asin"
                            >
                              <span className="font-mono text-[11px] font-black text-slate-400 group-hover/asin:text-blue-600 transition-colors underline decoration-dotted decoration-slate-300">{listing.asin || 'N/A'}</span>
                              <ExternalLink size={10} className="text-slate-200 group-hover/asin:text-blue-500" />
                            </a>
                          ) : (
                            <span className="font-mono text-[11px] font-black text-slate-400">{listing.asin || 'N/A'}</span>
                          )}
                          <span className="block mt-1 text-[8px] font-black text-slate-300 uppercase">{mkt?.flag} {listing.marketplace}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900">{mkt?.currency || '$'}{price.toFixed(2)}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{mkt?.name || 'US'}</span>
                        </div>
                      </td>
                      <td className="p-8"><p className="text-xs font-bold text-slate-800 line-clamp-2 leading-relaxed">{title}</p></td>
                      <td className="p-8 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={(e) => { e.stopPropagation(); onSelectListing(listing); }} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                          <button onClick={(e) => handleDelete(listing.id, e)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                   );
                })
              }
              {!isInitialLoading && paginatedListings.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto">
                      <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 shadow-inner">
                        <Package size={48} />
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                          {lang === 'zh' ? '暂无产品数据' : 'No Listings Found'}
                        </h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                          {lang === 'zh' 
                            ? '系统现已支持自动同步。如果您在插件中登录了相同账号并采集了数据，点击下方按钮即可完成归集。' 
                            : 'System now supports auto-sync. If you collected data using the same account in the extension, click the button below to sync.'}
                        </p>
                      </div>

                      <div className="w-full space-y-4">
                        <button 
                          onClick={refreshListings}
                          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
                        >
                          <RefreshCcw size={16} />
                          {lang === 'zh' ? '立即刷新并同步' : 'Refresh & Sync Now'}
                        </button>

                        <div className="pt-6 border-t border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">
                            {lang === 'zh' ? '进阶：手动配置 Token (可选)' : 'Advanced: Manual Token (Optional)'}
                          </p>
                          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <code className="text-[10px] font-mono font-black text-slate-500 flex-1 truncate text-left">
                              {userProfile?.org_id || '---'}
                            </code>
                            <button 
                              onClick={() => {
                                if (userProfile?.org_id) {
                                  navigator.clipboard.writeText(userProfile.org_id);
                                  alert(lang === 'zh' ? 'Token 已复制' : 'Token copied');
                                }
                              }}
                              className="p-2 text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm"
                              title="Copy Token"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-10 py-6 border-t border-slate-50 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows per page:</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black outline-none cursor-pointer hover:border-indigo-300 transition-colors"
              >
                {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {(currentPage-1)*itemsPerPage + 1} - {Math.min(currentPage*itemsPerPage, filteredListings.length)} of {filteredListings.length}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(1)} 
                className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
              >
                <ChevronsLeft size={18} />
              </button>
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = 1;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button 
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-900 border border-slate-100'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(totalPages)} 
                className="p-2 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
