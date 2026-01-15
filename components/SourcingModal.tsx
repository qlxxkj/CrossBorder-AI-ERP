
import React, { useState } from 'react';
import { X, Search, Plus, ExternalLink, Loader2, Check, AlertCircle } from 'lucide-react';
import { search1688WithAI } from '../services/geminiService';

interface SourcingResult {
  id: string;
  title: string;
  price: string;
  image: string;
  link: string;
}

interface SourcingModalProps {
  productImage: string;
  onClose: () => void;
  onAddLink: (record: SourcingResult) => void;
}

export const SourcingModal: React.FC<SourcingModalProps> = ({ productImage, onClose, onAddLink }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SourcingResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      // 真实调用 AI 联网搜索
      // 注意：此处如果能获取到 listing 的 title 会更准，此处作为组件内部状态
      const data = await search1688WithAI("Automotive Replacement Parts 1688", productImage);
      
      if (data && data.length > 0) {
        setResults(data.map((item, idx) => ({
          ...item,
          id: `ai-res-${idx}-${Date.now()}`
        })));
      } else {
        setError("No direct matches found on 1688. Try refining your product details.");
      }
      setHasSearched(true);
    } catch (err: any) {
      setError("Search failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50">
          <h2 className="text-xl font-black text-orange-900 flex items-center gap-2 uppercase tracking-tight">
            <Search size={24} /> 1688 Visual AI Match
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-orange-900">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in fade-in">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-40 h-40 rounded-[2rem] border-4 border-dashed border-orange-200 p-2 mb-8 bg-white shadow-xl">
                <img src={productImage} alt="Query" className="w-full h-full object-contain rounded-2xl" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Search 1688 by Image</h3>
              <p className="text-slate-500 max-w-sm mb-10 font-medium">Identify manufacturers and compare factory prices using visual recognition technology via Gemini 3 AI.</p>
              <button 
                onClick={handleSearch}
                disabled={loading}
                className="px-12 py-4 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-orange-600 shadow-xl shadow-orange-200 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                {loading ? 'Finding Suppliers...' : 'Start Visual Match'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {results.map(res => (
                <div key={res.id} className="group bg-white border border-slate-200 rounded-[2rem] overflow-hidden hover:shadow-2xl hover:border-orange-300 transition-all flex flex-col">
                  <div className="aspect-square relative overflow-hidden bg-slate-100">
                    <img src={res.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute top-4 right-4 bg-orange-500 text-white font-black px-3 py-1 rounded-full text-[10px] shadow-lg">
                      {res.price}
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-[10px] font-black text-slate-800 line-clamp-2 mb-4 h-8 uppercase tracking-tighter leading-relaxed">{res.title}</p>
                    <div className="mt-auto flex gap-2">
                      <button 
                        onClick={() => onAddLink(res)}
                        className="flex-1 py-2.5 bg-orange-50 text-orange-600 text-[10px] font-black rounded-xl hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-1 uppercase tracking-widest"
                      >
                        <Plus size={14} /> Add Source
                      </button>
                      <a 
                        href={res.link} 
                        target="_blank" 
                        className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-white transition-all shadow-sm"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
              <div 
                onClick={handleSearch}
                className="aspect-square border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-300 hover:text-orange-400 hover:border-orange-200 cursor-pointer transition-all"
              >
                <Search size={32} className="mb-2" />
                <span className="text-[10px] font-black uppercase">Refresh Search</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
