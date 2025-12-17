import React, { useState } from 'react';
import { Plus, Search, Bot, ExternalLink, CheckCircle } from 'lucide-react';
import { Listing, UILanguage } from '../types';
import { MOCK_CLEANED_DATA } from '../constants';
import { useTranslation } from '../lib/i18n';

interface DashboardProps {
  onSelectListing: (listing: Listing) => void;
  listings: Listing[];
  setListings: React.Dispatch<React.SetStateAction<Listing[]>>;
  lang: UILanguage;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectListing, listings, setListings, lang }) => {
  const t = useTranslation(lang);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSimulateImport = () => {
    const newListing: Listing = {
      id: Math.random().toString(36).substr(2, 9),
      asin: MOCK_CLEANED_DATA.asin,
      created_at: new Date().toISOString(),
      status: 'collected',
      cleaned: { ...MOCK_CLEANED_DATA, title: `${MOCK_CLEANED_DATA.title} (${listings.length + 1})` }
    };
    setListings([newListing, ...listings]);
  };

  const filteredListings = listings.filter(l => 
    l.cleaned.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.asin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">{t('totalListings')}</h3>
          <p className="text-4xl font-black text-slate-900 mt-2">{listings.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">{t('optimized')}</h3>
          <p className="text-4xl font-black text-indigo-600 mt-2">
            {listings.filter(l => l.status === 'optimized').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-xl text-white">
          <h3 className="text-blue-100 text-xs font-black uppercase tracking-widest">{t('extensionStatus')}</h3>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
            <p className="text-2xl font-black">{t('connected')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            type="text" 
            placeholder={t('searchPlaceholder')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
           <button 
             onClick={handleSimulateImport}
             className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold text-sm transition-all"
           >
            <Bot size={18} /> {t('simulateImport')}
           </button>
           <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-bold text-sm shadow-xl transition-all">
            <Plus size={18} /> {t('manualAdd')}
           </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-[0.2em]">
                <th className="p-6 w-20">Media</th>
                <th className="p-6">ASIN</th>
                <th className="p-6 w-1/2">Title</th>
                <th className="p-6">Price</th>
                <th className="p-6">Status</th>
                <th className="p-6 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredListings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-300 font-bold italic">
                    No data captured yet...
                  </td>
                </tr>
              ) : (
                filteredListings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6">
                      <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shadow-sm">
                        <img src={listing.cleaned.main_image} alt="" className="w-full h-full object-contain" />
                      </div>
                    </td>
                    <td className="p-6 font-mono text-xs font-bold text-slate-500 tracking-tighter">{listing.asin}</td>
                    <td className="p-6">
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">{listing.cleaned.title}</p>
                      <div className="flex gap-1 mt-1">
                        {listing.translations && Object.keys(listing.translations).map(k => (
                          <span key={k} className="text-[8px] px-1 bg-slate-100 rounded uppercase font-black text-slate-400">{k}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-6 text-sm font-black text-slate-900">${listing.cleaned.price}</td>
                    <td className="p-6">
                      {listing.status === 'optimized' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-600 border border-green-100">
                          <CheckCircle size={10} /> Optimized
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-400">
                          Captured
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => onSelectListing(listing)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all font-bold text-xs"
                      >
                        {t('edit')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};