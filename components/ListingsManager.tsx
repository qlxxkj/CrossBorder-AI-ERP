
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, CheckCircle, Trash2, Download, Package, 
  Loader2, Globe, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Languages, MoreHorizontal, Calendar, PackageOpen, RefreshCcw, Tags, ExternalLink, Edit3, DollarSign
} from 'lucide-react';
import { Listing, UILanguage, Category } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { ManualListingModal } from './ManualListingModal';
import { ExportModal } from './ExportModal';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';

interface ListingsManagerProps {
  onSelectListing: (listing: Listing) => void;
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
  lang: UILanguage;
  refreshListings: () => void;
  isInitialLoading?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

export const ListingsManager: React.FC<ListingsManagerProps> = ({ 
  onSelectListing, 
  listings = [], 
  setListings, 
  lang, 
  refreshListings,
  isInitialLoading 
}) => {
  const t = useTranslation(lang);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMarketplace, setFilterMarketplace] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchCategoryId, setBatchCategoryId] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data } = await supabase.from('categories').select('*');
      if (data && Array.isArray(data)) setCategories(data);
    } catch (e) {
      console.warn("Failed to fetch categories:", e);
    }
  };

  useEffect(() => {
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

  const filteredListings = useMemo(() => {
    if (!Array.isArray(listings)) return [];
    return listings.filter(l => {
      if (!l || !l.cleaned) return false;
      const displayTitle = (l.status === 'optimized' && l.optimized?.optimized_title) 
        ? l.optimized.optimized_title 
        : (l.cleaned?.title || "");
      
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
    const mkt = AMAZON_MARKETPLACES.find(m => m.code === mktCode);
    const domain = mkt?.domain || 'amazon.com';
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
                  {AMAZON_MARKETPLACES.find(m => m.code === code)?.flag || '🏳️'}
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
                  {AMAZON_MARKETPLACES.find(m => m.code === code)?.flag || '🏳️'}
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
      {isManualModalOpen && <ManualListingModal uiLang={lang} onClose={() => setIsManualModalOpen(false)} onSave={() => { setIsManualModalOpen(false); refreshListings(); }} />}
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
              {AMAZON_MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.code}</option>)}
            </select>
          </div>
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
              <button onClick={handleBulkDelete} disabled={isBatchDeleting} className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all" title="Delete Selected">
                {isBatchDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
           </div>
           
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
                   if (!listing || !listing.cleaned) return null;
                   
                   // 核心崩溃防护：强制将 price 转换为数字，防止字符串导致 toFixed(2) 报错
                   const rawPrice = (listing.status === 'optimized' && listing.optimized?.optimized_price !== undefined) 
                      ? listing.optimized.optimized_price 
                      : listing.cleaned.price;
                   const price = Number(rawPrice) || 0;
                   
                   const title = (listing.status === 'optimized' && listing.optimized?.optimized_title) 
                      ? listing.optimized.optimized_title 
                      : (listing.cleaned.title || "Untitled");
                   
                   const catName = categories.find(c => c.id === listing.category_id)?.name || '-';
                   const mkt = AMAZON_MARKETPLACES.find(m => m.code === listing.marketplace);
                   const sequenceNum = (currentPage - 1) * itemsPerPage + index + 1;
                   
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
                          <img src={listing.cleaned.main_image || ''} className="max-w-full max-h-full object-contain" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Img')} />
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
                          <a 
                            href={getAmazonUrl(listing.asin || '', listing.marketplace || 'US')}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 group/asin"
                          >
                            <span className="font-mono text-[11px] font-black text-slate-400 group-hover/asin:text-blue-600 transition-colors underline decoration-dotted decoration-slate-300">{listing.asin || 'N/A'}</span>
                            <ExternalLink size={10} className="text-slate-200 group-hover/asin:text-blue-500" />
                          </a>
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
                  <td colSpan={9} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-sm italic">
                    No matching listings found.
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
