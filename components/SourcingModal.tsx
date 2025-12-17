import React, { useState } from 'react';
import { X, Search, Plus, ExternalLink, Loader2, Check } from 'lucide-react';

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
  onAddLink: (link: string) => void;
}

export const SourcingModal: React.FC<SourcingModalProps> = ({ productImage, onClose, onAddLink }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SourcingResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const simulateSearch = () => {
    setLoading(true);
    setTimeout(() => {
      setResults([
        { id: '1', title: 'Factory Direct Ceramic Brake Pads - High Quality', price: '¥22.50', image: 'https://picsum.photos/seed/p1/200/200', link: 'https://1688.com/product/1' },
        { id: '2', title: 'Premium Brake Set for Lexus/Toyota', price: '¥18.90', image: 'https://picsum.photos/seed/p2/200/200', link: 'https://1688.com/product/2' },
        { id: '3', title: 'Automotive Replacement Parts - Wholesale', price: '¥25.00', image: 'https://picsum.photos/seed/p3/200/200', link: 'https://1688.com/product/3' },
        { id: '4', title: 'QuietCast Style Brake Pads - Bulk', price: '¥15.00', image: 'https://picsum.photos/seed/p4/200/200', link: 'https://1688.com/product/4' },
      ]);
      setLoading(false);
      setHasSearched(true);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50">
          <h2 className="text-xl font-bold text-orange-900 flex items-center gap-2">
            <Search size={24} /> 1688 Visual Search
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-orange-900">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-32 h-32 rounded-xl border-4 border-dashed border-orange-200 p-2 mb-6">
                <img src={productImage} alt="Query" className="w-full h-full object-contain rounded-lg" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Search 1688 by Image</h3>
              <p className="text-slate-500 max-w-sm mb-8">We will use the product's main image to find identical or similar manufacturers on 1688.com</p>
              <button 
                onClick={simulateSearch}
                className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-200 transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                Start Visual Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {results.map(res => (
                <div key={res.id} className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl transition-all">
                  <div className="aspect-square relative overflow-hidden bg-slate-100">
                    <img src={res.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-2 right-2 bg-orange-500 text-white font-bold px-2 py-1 rounded text-sm">
                      {res.price}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-slate-800 line-clamp-2 mb-3 h-8">{res.title}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onAddLink(res.link)}
                        className="flex-1 py-2 bg-orange-50 text-orange-600 text-xs font-bold rounded hover:bg-orange-100 flex items-center justify-center gap-1"
                      >
                        <Plus size={14} /> Add Sourcing
                      </button>
                      <a 
                        href={res.link} 
                        target="_blank" 
                        className="p-2 border border-slate-200 rounded text-slate-400 hover:text-orange-500"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};