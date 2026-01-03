
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Search, CheckCircle, Trash2, Download, Filter, Package, 
  Loader2, Zap, Globe, Trash, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, AlertCircle, RefreshCcw, 
  Database, ShieldCheck, Languages, MoreHorizontal, DollarSign, Calendar
} from 'lucide-react';
import { Listing, UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { ManualListingModal } from './ManualListingModal';
import { ExportModal } from './ExportModal';

interface ListingsManagerProps {
  onSelectListing: (listing: Listing) => void;
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
  lang: UILanguage;
  refreshListings: () => void;
  isInitialLoading?: boolean;
}

const MARKETPLACES_LIST = [
  { code: 'ALL', name: 'All Sites', flag: '🌍', currency: '¤' },
  { code: 'US', name: 'USA', flag: '🇺🇸', currency: '$' },
  { code: 'UK', name: 'UK', flag: '🇬🇧', currency: '£' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: '€' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: '€' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: '¥' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [jumpPage, setJumpPage] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMarketplace, itemsPerPage]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = lang === 'zh' ? "确定要删除此产品吗？" : "Are you sure you want to delete this?";
    if (!window.confirm(confirmMsg)) return;
    
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
      : `Are you sure you want to delete the ${selectedIds.size} selected items?`;
    
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
  
  const pageButtons = useMemo(() => {
    const range = 2;
    const buttons = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
        buttons.push(i);
      } else if (buttons[buttons.length - 1] !== -1) {
        buttons.push(-1); // Ellipsis placeholder
      }
    }
    return buttons;
  }, [totalPages, currentPage]);

  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredListings.slice(start, start + itemsPerPage);
  }, [filteredListings, currentPage, itemsPerPage]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedListings.length && paginatedListings.length > 0) {
      const next = new Set(selectedIds);
      paginatedListings.forEach(l => next.delete(l.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginatedListings.forEach(l => next.add(l.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPage);
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setJumpPage('');
    }
  };

  const renderPagination = () => {
    if (filteredListings.length === 0) return null;

    const startIdx = (currentPage - 1) * itemsPerPage + 1;
    const endIdx = Math.min(currentPage * itemsPerPage, filteredListings.length);

    return (
      <div className="px-8 py-6 bg-white border-t border-slate-100 flex flex-col xl:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'zh' ? '每页显示' : 'Rows per page'}</span>
            <select 
              value={itemsPerPage} 
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500"
            >
              {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <p className="text-xs font-bold text-slate-500">
            {lang === 'zh' ? `第 ${startIdx}-${endIdx} 条 / 共 ${filteredListings.length} 条` : `Showing ${startIdx}-${endIdx} of ${filteredListings.length}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentPage(1)} 
              disabled={currentPage === 1} 
              className="p-2 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-500 rounded-lg border border-slate-100 transition-all"
            >
              <ChevronsLeft size={16} />
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
              disabled={currentPage === 1} 
              className="p-2 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-500 rounded-lg border border-slate-100 transition-all"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1 mx-2">
              {pageButtons.map((p, idx) => (
                p === -1 ? (
                  <span key={`ell-${idx}`} className="px-2 text-slate-300">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-black transition-all ${
                      currentPage === p 
                        ? 'bg-indigo-600 text-white shadow-lg' 
                        : 'bg-white text-slate-500 hover:border-slate-300 border border-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              ))}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
              disabled={currentPage === totalPages} 
              className="p-2 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-500 rounded-lg border border-slate-100 transition-all"
            >
              <ChevronRight size={16} />
            </button>
            <button 
              onClick={() => setCurrentPage(totalPages)} 
              disabled={currentPage === totalPages} 
              className="p-2 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-500 rounded-lg border border-slate-100 transition-all"
            >
              <ChevronsRight size={16} />
            </button>
          </div>

          <form onSubmit={handleJumpPage} className="flex items-center gap-2 ml-4">
            <input 
              type="number" 
              placeholder="Go" 
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              className="w-12 px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
            <button type="submit" className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
              {lang === 'zh' ? '跳转' : 'Jump'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const getCurrencySymbol = (marketplaceCode: string) => {
    return MARKETPLACES_LIST.find(m => m.code === marketplaceCode)?.currency || '$';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {isManualModalOpen && <ManualListingModal uiLang={lang} onClose={() => setIsManualModalOpen(false)} onSave={() => { setIsManualModalOpen(false); refreshListings(); }} />}
      {isExportModalOpen && <ExportModal uiLang={lang} selectedListings={listings.filter(l => selectedIds.has(l.id))} onClose={() => setIsExportModalOpen(false)} />}

      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('listings')}</h2>
        <p className="text-slate-400 font-medium text-sm">Organize and process your cross-border inventory.</p>
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
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-sm shadow-sm transition-all" 
            />
          </div>
          <div className="relative min-w-[160px]">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
            <select 
              value={filterMarketplace} 
              onChange={(e) => setFilterMarketplace(e.target.value)} 
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm cursor-pointer appearance-none"
            >
              {MARKETPLACES_LIST.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
           <button 
             onClick={handleBulkDelete} 
             disabled={isBatchDeleting || selectedIds.size === 0}
             className="px-6 py-3.5 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 font-black text-xs border border-red-100 uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-40 disabled:grayscale"
           >
             {isBatchDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
             {lang === 'zh' ? '批量删除' : 'Delete'} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
           </button>
           <button 
             onClick={() => setIsExportModalOpen(true)} 
             disabled={selectedIds.size === 0}
             className="px-6 py-3.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 font-black text-xs border border-indigo-100 uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-40 disabled:grayscale"
           >
             <Download size={16} /> {t('export')} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
           </button>
           <div className="w-px h-8 bg-slate-200 mx-1 hidden lg:block self-center"></div>
           <button onClick={() => setIsManualModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 font-black text-xs shadow-xl transition-all uppercase tracking-widest">
            <Plus size={16} /> {t('manualAdd')}
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[450px]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-[0.2em]">
                <th className="p-6 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                    checked={paginatedListings.length > 0 && paginatedListings.every(l => selectedIds.has(l.id))} 
                    onChange={toggleSelectAll} 
                  />
                </th>
                <th className="p-6 w-24 text-center">Img</th>
                <th className="p-6">Market</th>
                <th className="p-6">ASIN</th>
                <th className="p-6 w-1/3">Product Information</th>
                <th className="p-6">Price</th>
                <th className="p-6">Update Date</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isInitialLoading ? (
                [1, 2, 3, 4, 5].map(i => <tr key={i} className="animate-pulse"><td colSpan={9} className="p-8"><div className="h-12 bg-slate-50 rounded-2xl w-full"></div></td></tr>)
              ) : paginatedListings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-32 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-6">
                      <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner flex items-center justify-center text-slate-200">
                         <Package size={48} />
                      </div>
                      <div className="space-y-2">
                        <p className="font-black uppercase tracking-widest text-sm text-slate-900">{searchTerm ? 'No search results' : 'Inventory Empty'}</p>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          {searchTerm ? 'Adjust your search filters.' : 'Manually add your first listing or use the collector plugin.'}
                        </p>
                      </div>
                      <button onClick={() => setIsManualModalOpen(true)} className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95">
                         <Plus size={14} /> Add First Product
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedListings.map((listing) => {
                   const title = (listing.status === 'optimized' && listing.optimized?.optimized_title) 
                     ? listing.optimized.optimized_title 
                     : (listing.cleaned?.title || "No Title");
                   
                   const translatedMarkets = listing.translations ? Object.keys(listing.translations) : [];

                   return (
                    <tr 
                      key={listing.id} 
                      className={`hover:bg-slate-50/80 transition-all group cursor-pointer ${selectedIds.has(listing.id) ? 'bg-indigo-50/30' : ''}`} 
                      onClick={() => onSelectListing(listing)}
                    >
                      <td className="p-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                          checked={selectedIds.has(listing.id)} 
                          onChange={(e) => toggleSelectOne(listing.id, e as any)} 
                        />
                      </td>
                      <td className="p-6">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center p-1 group-hover:scale-105 transition-transform duration-500">
                          <img 
                            src={listing.cleaned?.main_image || "https://picsum.photos/200/200?grayscale"} 
                            className="max-w-full max-h-full object-contain" 
                            loading="lazy"
                          />
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-black text-[10px] uppercase tracking-tighter border border-slate-200">
                          {MARKETPLACES_LIST.find(m => m.code === listing.marketplace)?.flag || '📦'} {listing.marketplace}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className="font-mono text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 tracking-tighter">{listing.asin}</span>
                      </td>
                      <td className="p-6">
                        <p className="text-xs font-black text-slate-800 line-clamp-2 leading-relaxed max-w-xs mb-2">{title}</p>
                        <div className="flex items-center gap-2">
                           <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase border border-indigo-100 flex items-center gap-1">
                             <Languages size={10} /> {translatedMarkets.length} Translations
                           </span>
                           {translatedMarkets.slice(0, 3).map(m => (
                             <span key={m} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[8px] font-black uppercase">{m}</span>
                           ))}
                           {translatedMarkets.length > 3 && <span className="text-[8px] font-bold text-slate-300">+{translatedMarkets.length - 3}</span>}
                        </div>
                      </td>
                      <td className="p-6">
                         <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 flex items-center gap-0.5">
                              <span className="text-slate-400 font-bold">{getCurrencySymbol(listing.marketplace)}</span>
                              {listing.cleaned?.price || '0.00'}
                            </span>
                            {listing.cleaned?.shipping > 0 && (
                              <span className="text-[9px] font-bold text-slate-400">+{listing.cleaned.shipping} Ship</span>
                            )}
                         </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px]">
                          <Calendar size={12} className="text-slate-300" />
                          {new Date(listing.updated_at || listing.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-6">
                        {listing.status === 'optimized' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase border border-green-100 shadow-sm shadow-green-100/50 animate-in zoom-in-95">
                            <CheckCircle size={10} /> Optimized
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase border border-slate-200">
                            Raw Feed
                          </span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onSelectListing(listing); }} 
                            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          <button 
                            onClick={(e) => handleDelete(listing.id, e)} 
                            className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                   );
                })
              )}
            </tbody>
          </table>
        </div>
        {renderPagination()}
      </div>
    </div>
  );
};
