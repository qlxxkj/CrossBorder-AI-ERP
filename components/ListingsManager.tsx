
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, CheckCircle, Trash2, Download, Filter, Package, Loader2, Zap, Globe, Trash, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, RefreshCcw, Database, ShieldCheck } from 'lucide-react';
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

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) startPage = Math.max(1, endPage - maxVisiblePages + 1);
    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
      <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between">
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase">Showing {filteredListings.length} total</p>
          <nav className="relative z-0 inline-flex gap-2">
            {pages.map(p => (
              <button key={p} onClick={() => setCurrentPage(p)} className={`px-4 py-2 rounded-xl border text-xs font-black ${currentPage === p ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500'}`}>{p}</button>
            ))}
          </nav>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {isManualModalOpen && <ManualListingModal uiLang={lang} onClose={() => setIsManualModalOpen(false)} onSave={() => { setIsManualModalOpen(false); refreshListings(); }} />}
      {isBulkScrapeOpen && <BulkScrapeModal uiLang={lang} onClose={() => setIsBulkScrapeOpen(false)} onFinished={() => { setIsBulkScrapeOpen(false); refreshListings(); }} />}
      {isExportModalOpen && <ExportModal uiLang={lang} selectedListings={listings.filter(l => selectedIds.has(l.id))} onClose={() => setIsExportModalOpen(false)} />}

      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('listings')}</h2>
        <p className="text-slate-400 font-medium text-sm">Organize your cross-border inventory ({listings.length} rows sync'd).</p>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex flex-1 gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder={t('searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-sm shadow-sm" />
          </div>
          <select value={filterMarketplace} onChange={(e) => setFilterMarketplace(e.target.value)} className="min-w-[160px] px-6 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none shadow-sm cursor-pointer">
            {MARKETPLACES_LIST.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 w-full lg:w-auto">
           {selectedIds.size > 0 && (
             <button onClick={() => setIsExportModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 font-black text-xs border border-indigo-100 uppercase tracking-widest transition-all">
               <Download size={18} /> {t('export')} ({selectedIds.size})
             </button>
           )}
           <button onClick={() => setIsBulkScrapeOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 text-white rounded-2xl hover:bg-amber-600 font-black text-xs shadow-xl uppercase tracking-widest transition-all">
            <Zap size={18} /> {t('bulkScrape')}
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-[0.2em]">
                <th className="p-6 w-12"><input type="checkbox" className="rounded" checked={selectedIds.size === filteredListings.length && filteredListings.length > 0} onChange={toggleSelectAll} /></th>
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
                [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={7} className="p-8"><div className="h-10 bg-slate-50 rounded-xl w-full"></div></td></tr>)
              ) : paginatedListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner flex items-center justify-center text-slate-200">
                         {listings.length > 0 ? <Search size={40} /> : <ShieldCheck size={40} className="text-amber-300" />}
                      </div>
                      <div className="space-y-2">
                        <p className="font-black uppercase tracking-widest text-sm text-slate-900">
                          {listings.length > 0 ? 'No Matches' : 'Zero Records Found'}
                        </p>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          {listings.length > 0 
                            ? "Try clearing your search or marketplace filters." 
                            : "If you have data but it's not showing, your Supabase 'Policy' might be blocking access. Ensure you have a 'SELECT' policy for Authenticated Users."}
                        </p>
                      </div>
                      <button onClick={refreshListings} className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                         <RefreshCcw size={14} /> Refresh Query
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedListings.map((listing) => (
                  <tr key={listing.id} className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${selectedIds.has(listing.id) ? 'bg-indigo-50/40' : ''}`} onClick={() => onSelectListing(listing)}>
                    <td className="p-6" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="rounded" checked={selectedIds.has(listing.id)} onChange={(e) => toggleSelectOne(listing.id, e as any)} /></td>
                    <td className="p-6"><div className="w-14 h-14 mx-auto rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center p-1"><img src={listing.cleaned?.main_image || "https://picsum.photos/200/200?grayscale"} className="max-w-full max-h-full object-contain" /></div></td>
                    <td className="p-6 font-black text-xs">{listing.marketplace || 'US'}</td>
                    <td className="p-6 font-mono text-[11px] font-black text-slate-500">{listing.asin}</td>
                    <td className="p-6"><p className="text-sm font-black text-slate-800 line-clamp-1">{(listing.status === 'optimized' && listing.optimized?.optimized_title) ? listing.optimized.optimized_title : listing.cleaned?.title}</p></td>
                    <td className="p-6">{listing.status === 'optimized' ? <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase">Optimized</span> : <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase">Raw</span>}</td>
                    <td className="p-6 text-right opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); onSelectListing(listing); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Edit</button></td>
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
