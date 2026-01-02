
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, CheckCircle, Trash2, Download, Filter, Package, Loader2, Zap, Globe, Trash, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, RefreshCcw, Database } from 'lucide-react';
import { Listing, UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { ManualListingModal } from './ManualListingModal';
import { ExportModal } from './ExportModal';
import { BulkScrapeModal } from './BulkScrapeModal';

interface ListingsManagerProps {
  onSelectListing: (listing: Listing) => void;
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
  lang: UILanguage;
  refreshListings: () => void;
  isInitialLoading?: boolean;
}

const MARKETPLACES_LIST = [
  { code: 'ALL', name: 'All Sites', flag: '🌍' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'UK', name: 'UK', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

export const ListingsManager: React.FC<ListingsManagerProps> = ({ 
  onSelectListing, 
  listings, 
  setListings, 
  lang, 
  refreshListings,
  isInitialLoading 
}) => {
  const t = useTranslation(lang);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMarketplace, setFilterMarketplace] = useState('ALL');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBulkScrapeOpen, setIsBulkScrapeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMarketplace]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('listings').delete().eq('id', id);
      if (error) alert(error.message);
      else refreshListings();
    } else {
      setListings(prev => prev.filter(l => l.id !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmMsg = lang === 'zh' 
      ? `确定要删除选中的 ${selectedIds.size} 个产品吗？此操作不可撤销。`
      : `Are you sure you want to delete the ${selectedIds.size} selected items? This cannot be undone.`;
    
    if (!window.confirm(confirmMsg)) return;

    setIsBatchDeleting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('listings')
          .delete()
          .in('id', Array.from(selectedIds));
        
        if (error) throw error;
        
        setSelectedIds(new Set());
        refreshListings();
      } else {
        const ids = Array.from(selectedIds);
        setListings(prev => prev.filter(l => !ids.includes(l.id)));
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const filteredListings = useMemo(() => {
    return listings.filter(l => {
      const displayTitle = (l.status === 'optimized' && l.optimized?.optimized_title) 
        ? l.optimized.optimized_title 
        : l.cleaned?.title;
      
      const matchesSearch = (displayTitle || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (l.asin || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesMarketplace = filterMarketplace === 'ALL' || l.marketplace === filterMarketplace;
      
      return matchesSearch && matchesMarketplace;
    });
  }, [listings, searchTerm, filterMarketplace]);

  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredListings.slice(start, start + itemsPerPage);
  }, [filteredListings, currentPage]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredListings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredListings.map(l => l.id)));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const getMarketplaceFlag = (code: string) => {
    return MARKETPLACES_LIST.find(m => m.code === code)?.flag || '📦';
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-slate-200 text-sm font-black rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-200 text-sm font-black rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredListings.length)}</span> of <span className="text-slate-900">{filteredListings.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex gap-2 rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center p-2 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center p-2 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              
              {pages.map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`relative inline-flex items-center px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-tighter transition-all shadow-sm ${
                    currentPage === p
                      ? 'z-10 bg-indigo-600 border-indigo-600 text-white shadow-indigo-100 scale-110'
                      : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center p-2 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center p-2 rounded-xl border border-slate-100 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
              >
                <ChevronsRight size={16} />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {isManualModalOpen && (
        <ManualListingModal 
          uiLang={lang} 
          onClose={() => setIsManualModalOpen(false)} 
          onSave={() => {
            setIsManualModalOpen(false);
            refreshListings();
          }}
        />
      )}

      {isBulkScrapeOpen && (
        <BulkScrapeModal 
          uiLang={lang}
          onClose={() => setIsBulkScrapeOpen(false)}
          onFinished={() => {
            setIsBulkScrapeOpen(false);
            refreshListings();
          }}
        />
      )}

      {isExportModalOpen && (
        <ExportModal 
          uiLang={lang} 
          selectedListings={listings.filter(l => selectedIds.has(l.id))}
          onClose={() => setIsExportModalOpen(false)} 
        />
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('listings')}</h2>
        <p className="text-slate-400 font-medium text-sm">Organize and filter your cross-border inventory.</p>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex flex-1 gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder={t('searchPlaceholder')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm font-bold text-sm"
            />
          </div>
          <div className="relative min-w-[160px]">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <select 
              value={filterMarketplace}
              onChange={(e) => setFilterMarketplace(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm font-bold text-sm appearance-none cursor-pointer"
            >
              {MARKETPLACES_LIST.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
           {selectedIds.size > 0 && (
             <>
               <button 
                 onClick={handleBulkDelete}
                 disabled={isBatchDeleting}
                 className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 font-black text-xs transition-all border border-red-100 shadow-sm uppercase tracking-widest disabled:opacity-50"
               >
                 {isBatchDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                 {lang === 'zh' ? '批量删除' : 'Delete'} ({selectedIds.size})
               </button>
               <button 
                 onClick={() => setIsExportModalOpen(true)}
                 className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 font-black text-xs transition-all border border-indigo-100 shadow-sm uppercase tracking-widest"
               >
                 <Download size={18} /> {t('export')} ({selectedIds.size})
               </button>
             </>
           )}
           <button 
             onClick={() => setIsBulkScrapeOpen(true)}
             className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 font-black text-xs shadow-xl shadow-amber-100 transition-all uppercase tracking-widest border border-amber-400"
           >
            <Zap size={18} /> {t('bulkScrape')}
           </button>
           <button 
             onClick={() => setIsManualModalOpen(true)}
             className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 font-black text-xs shadow-xl transition-all uppercase tracking-widest"
           >
            <Plus size={18} /> {t('manualAdd')}
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-[0.2em]">
                <th className="p-6 w-12">
                   <input 
                     type="checkbox" 
                     className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                     checked={selectedIds.size === filteredListings.length && filteredListings.length > 0}
                     onChange={toggleSelectAll}
                   />
                </th>
                <th className="p-6 w-24 text-center">Preview</th>
                <th className="p-6">Market</th>
                <th className="p-6">ASIN / SKU</th>
                <th className="p-6 w-1/2">Product Info</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isInitialLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="p-8"><div className="h-10 bg-slate-50 rounded-xl w-full"></div></td>
                  </tr>
                ))
              ) : paginatedListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner flex items-center justify-center text-slate-200">
                         <Package size={40} />
                      </div>
                      <div className="space-y-2">
                        <p className="font-black uppercase tracking-widest text-sm text-slate-900">
                          {searchTerm || filterMarketplace !== 'ALL' ? 'No matches found' : 'Database Empty'}
                        </p>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          {searchTerm || filterMarketplace !== 'ALL' 
                            ? "Try adjusting your filters or keywords." 
                            : "If you have scraped data but it's not showing, your Supabase RLS policies might be blocking the session. Check if 'user_id' matches exactly."}
                        </p>
                      </div>
                      <div className="flex gap-3">
                         <button onClick={refreshListings} className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                           <RefreshCcw size={14} /> Refresh
                         </button>
                         <button onClick={() => setIsBulkScrapeOpen(true)} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                           <Zap size={14} /> Start Scrape
                         </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedListings.map((listing) => (
                  <tr 
                    key={listing.id} 
                    className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${selectedIds.has(listing.id) ? 'bg-indigo-50/40' : ''}`}
                    onClick={() => onSelectListing(listing)}
                  >
                    <td className="p-6" onClick={(e) => e.stopPropagation()}>
                       <input 
                         type="checkbox" 
                         className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                         checked={selectedIds.has(listing.id)}
                         onChange={(e) => { e.stopPropagation(); toggleSelectOne(listing.id, e as any); }}
                       />
                    </td>
                    <td className="p-6">
                      <div className="w-14 h-14 mx-auto rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center p-1 group-hover:scale-105 transition-transform">
                        <img src={listing.cleaned?.main_image || "https://picsum.photos/200/200?grayscale"} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                    </td>
                    <td className="p-6">
                       <div className="flex flex-col items-center gap-1">
                          <span className="text-2xl">{getMarketplaceFlag(listing.marketplace)}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{listing.marketplace || 'Manual'}</span>
                       </div>
                    </td>
                    <td className="p-6">
                       <span className="font-mono text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded tracking-tighter border border-slate-200">{listing.asin}</span>
                    </td>
                    <td className="p-6">
                      <p className="text-sm font-black text-slate-800 line-clamp-1 leading-relaxed">
                        {(listing.status === 'optimized' && listing.optimized?.optimized_title) 
                          ? listing.optimized.optimized_title 
                          : (listing.cleaned?.title || "No Title")}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        <span className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-black uppercase border border-blue-100">${listing.cleaned?.price || 0}</span>
                        {listing.translations && Object.keys(listing.translations).map(k => (
                          <span key={k} className="text-[8px] px-1.5 py-0.5 bg-slate-100 rounded-md uppercase font-black text-slate-400 border border-slate-200">{k}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-6">
                      {listing.status === 'optimized' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase bg-green-50 text-green-600 border border-green-100 shadow-sm">
                          <CheckCircle size={10} /> Optimized
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400 border border-slate-200">
                          Raw Capture
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSelectListing(listing); }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
                        >
                          {t('edit')}
                        </button>
                        <button 
                          onClick={(e) => handleDelete(listing.id, e)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors transform hover:scale-110"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {renderPagination()}
      </div>
    </div>
  );
};
