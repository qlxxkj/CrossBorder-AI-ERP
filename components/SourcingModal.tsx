
import React, { useState } from 'react';
import { X, Search, Plus, ExternalLink, Loader2, Check, AlertCircle, Settings2 } from 'lucide-react';
import { search1688ByImage, SourcingProduct } from '../services/sourcingService';

interface SourcingModalProps {
  productImage: string;
  onClose: () => void;
  onAddLink: (record: SourcingProduct) => void;
}

export const SourcingModal: React.FC<SourcingModalProps> = ({ productImage, onClose, onAddLink }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SourcingProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRealSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await search1688ByImage(productImage);
      setResults(data);
      setHasSearched(true);
    } catch (err: any) {
      if (err.message.includes("API_KEY")) {
        setError("API Key Required: Please go to 'System Settings' and configure your 1688 API Key first.");
      } else {
        setError(err.message || "Network Error: 1688 API currently unavailable.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg">
               <Search size={20} />
            </div>
            <div>
               <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">1688 Visual Engine</h2>
               <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Real-time Factory Discovery</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/20">
          {error && (
            <div className="mb-8 p-5 bg-red-50 border-2 border-red-100 rounded-3xl flex items-start gap-4 text-red-600 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={24} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-sm uppercase mb-1">Search Interrupted</p>
                <p className="text-xs font-medium leading-relaxed opacity-80">{error}</p>
                {error.includes("Key") && (
                  <button className="mt-3 flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                    <Settings2 size={12} /> Configure API
                  </button>
                )}
              </div>
            </div>
          )}

          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative group">
                <div className="absolute -inset-4 bg-orange-500/10 rounded-[3rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-48 h-48 rounded-[2.5rem] border-4 border-dashed border-orange-200 p-2 mb-8 bg-white shadow-2xl relative">
                  <img src={productImage} alt="Query" className="w-full h-full object-contain rounded-3xl" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Image-to-Source</h3>
              <p className="text-slate-500 max-w-sm mb-12 font-medium">Transmit visual tokens to 1688's database to identify direct manufacturers and wholesale pricing.</p>
              <button 
                onClick={handleRealSearch}
                disabled={loading}
                className="px-14 py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest hover:bg-orange-600 shadow-2xl shadow-orange-200 transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Search size={22} />}
                {loading ? 'Interrogating 1688...' : 'Start Real Discovery'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {results.map(res => (
                <div key={res.id} className="group bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:border-orange-300 transition-all flex flex-col shadow-sm">
                  <div className="aspect-square relative overflow-hidden bg-slate-50">
                    <img src={res.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-orange-600 font-black px-4 py-1.5 rounded-full text-xs shadow-lg border border-orange-100">
                      {res.price}
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-[10px] font-black text-slate-800 line-clamp-2 mb-6 h-8 uppercase tracking-tighter leading-relaxed">{res.title}</p>
                    <div className="mt-auto flex gap-2">
                      <button 
                        onClick={() => onAddLink(res)}
                        className="flex-1 py-3 bg-orange-50 text-orange-600 text-[10px] font-black rounded-2xl hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                      >
                        <Plus size={14} /> Link
                      </button>
                      <a 
                        href={res.url} 
                        target="_blank" 
                        className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:bg-white transition-all shadow-sm"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={handleRealSearch}
                className="aspect-square border-4 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-300 hover:text-orange-500 hover:border-orange-200 transition-all group"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-orange-50 mb-4 transition-all">
                   <Search size={32} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Refresh Search</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
