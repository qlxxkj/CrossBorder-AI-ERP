
import React, { useState, useEffect } from 'react';
import { Loader2, Maximize2, Wand2, Star, Trash2, Plus, RefreshCcw } from 'lucide-react';
import { Listing } from '../types';

interface ListingImageSectionProps {
  listing: Listing;
  previewImage: string;
  setPreviewImage: (url: string) => void;
  updateField: (field: string, value: any) => void;
  updateFields: (fields: Record<string, any>) => void;
  isSaving: boolean;
  isProcessing: boolean;
  processingUrls: Set<string>;
  onStandardizeAll: () => void;
  onStandardizeOne: (url: string) => void;
  onRestoreAll: () => void;
  setShowEditor: (show: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const ListingImageSection: React.FC<ListingImageSectionProps> = ({
  listing, previewImage, setPreviewImage, updateField, updateFields, isSaving, isProcessing, processingUrls, onStandardizeAll, onStandardizeOne, onRestoreAll, setShowEditor, fileInputRef
}) => {
  const [hoverImage, setHoverImage] = useState<string | null>(null);
  
  // Calculate effective images: Priority to Optimized, fallback to Cleaned
  const effectiveMain = listing.optimized?.optimized_main_image || listing.cleaned?.main_image || '';
  const effectiveOthers = listing.optimized?.optimized_other_images || listing.cleaned?.other_images || [];
  const allImages = [effectiveMain, ...effectiveOthers].filter(Boolean) as string[];

  useEffect(() => {
    setHoverImage(null);
  }, [previewImage, listing.id]);

  const activeDisplayImage = hoverImage || previewImage;

  const handleSetMain = (url: string) => {
    if (url === effectiveMain) return;
    
    const others = [...effectiveOthers];
    const targetIdx = others.indexOf(url);
    
    if (targetIdx > -1) {
      others[targetIdx] = effectiveMain;
      updateFields({
        main_image: url,
        other_images: others
      });
      setPreviewImage(url);
    }
  };

  const handleRemoveImage = (url: string) => {
    if (effectiveMain === url) {
      const others = [...effectiveOthers];
      if (others.length > 0) {
        const newMain = others[0];
        updateFields({
          main_image: newMain,
          other_images: others.slice(1)
        });
        setPreviewImage(newMain);
      } else {
        updateField('main_image', '');
        setPreviewImage('');
      }
    } else {
      const others = effectiveOthers.filter(u => u !== url);
      updateField('other_images', others);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
         {(isSaving || isProcessing) && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>}
         <img 
          src={activeDisplayImage} 
          key={activeDisplayImage}
          className="max-w-full max-h-full object-contain transition-all duration-300" 
          onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400?text=Image+Load+Error'; }}
         />
         
         <div className="absolute bottom-4 right-4 flex gap-2">
            <button 
              onClick={onRestoreAll} 
              disabled={isProcessing || (!listing.optimized?.optimized_main_image && !listing.optimized?.optimized_other_images)}
              className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase shadow-sm flex items-center gap-2 hover:bg-slate-200 transition-all border border-slate-200 disabled:opacity-30"
              title="Restore to original scraped images"
            >
              <RefreshCcw size={12} /> Restore Original
            </button>
            <button onClick={onStandardizeAll} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-indigo-200"><Maximize2 size={12} /> Standardize All</button>
            <button onClick={() => setShowEditor(true)} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all"><Wand2 size={12} /> AI Editor</button>
         </div>
      </div>

      <div className="flex flex-wrap gap-2">
         {allImages.map((img, i) => {
           const isSelfProcessing = processingUrls.has(img);
           const isMain = img === effectiveMain;
           
           return (
             <div 
              key={`${img}-${i}`} 
              onMouseEnter={() => setHoverImage(img)}
              onMouseLeave={() => setHoverImage(null)}
              onClick={() => {
                setPreviewImage(img);
                setHoverImage(null);
              }} 
              className={`group/thumb relative w-16 h-16 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden transition-all ${previewImage === img ? 'border-indigo-500 shadow-lg scale-105 z-10' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
             >
                <img src={img} className="w-full h-full object-cover" />
                
                <div className={`absolute inset-0 bg-black/40 flex flex-col justify-between p-1 transition-opacity ${isSelfProcessing ? 'opacity-100' : 'opacity-0 group-hover/thumb:opacity-100'}`}>
                   <div className="flex justify-between w-full">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSetMain(img); }} 
                        className={`p-1 rounded-lg text-white transition-colors ${isMain ? 'bg-amber-500' : 'bg-white/20 hover:bg-amber-400'}`}
                        title="Set as Main"
                        disabled={isSelfProcessing}
                      >
                        <Star size={10} fill={isMain ? "currentColor" : "none"} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(img); }} 
                        className="p-1 bg-white/20 hover:bg-red-500 rounded-lg text-white transition-colors"
                        title="Remove Image"
                        disabled={isSelfProcessing}
                      >
                        <Trash2 size={10} />
                      </button>
                   </div>
                   
                   <button 
                    onClick={(e) => { e.stopPropagation(); onStandardizeOne(img); }} 
                    title="Standardize to 1600px"
                    disabled={isSelfProcessing}
                    className="w-5 h-5 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-400 transition-colors shadow-lg self-start"
                   >
                     {isSelfProcessing ? <Loader2 size={10} className="animate-spin" /> : <Maximize2 size={10} />}
                   </button>
                </div>

                {isSelfProcessing && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <Loader2 size={12} className="animate-spin text-indigo-600" />
                  </div>
                )}
             </div>
           );
         })}
         <button 
           onClick={() => fileInputRef.current?.click()} 
           disabled={isProcessing}
           className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50 shrink-0"
         >
           {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={20} />}
         </button>
      </div>
    </div>
  );
};
