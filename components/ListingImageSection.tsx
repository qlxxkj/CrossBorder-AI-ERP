
import React, { useState, useEffect } from 'react';
import { Loader2, Maximize2, Wand2, Star, Trash2, Plus, Zap } from 'lucide-react';
import { Listing } from '../types';

interface ListingImageSectionProps {
  listing: Listing;
  previewImage: string;
  setPreviewImage: (url: string) => void;
  updateField: (field: string, value: any) => void;
  isSaving: boolean;
  isProcessing: boolean;
  onStandardizeAll: () => void;
  onStandardizeOne: (url: string) => void;
  setShowEditor: (show: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const ListingImageSection: React.FC<ListingImageSectionProps> = ({
  listing, previewImage, setPreviewImage, updateField, isSaving, isProcessing, onStandardizeAll, onStandardizeOne, setShowEditor, fileInputRef
}) => {
  const [hoverImage, setHoverImage] = useState<string | null>(null);
  const allImages = [listing.cleaned?.main_image, ...(listing.cleaned?.other_images || [])].filter(Boolean) as string[];

  // 当预览图或列表数据发生根本变化时，重置悬浮状态，确保 UI 逻辑清晰
  useEffect(() => {
    setHoverImage(null);
  }, [previewImage, listing.id]);

  const activeDisplayImage = hoverImage || previewImage;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
         {(isSaving || isProcessing) && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>}
         <img 
          src={activeDisplayImage} 
          key={activeDisplayImage} // 使用 key 强制触发图片组件重新渲染，避免缓存
          className="max-w-full max-h-full object-contain transition-all duration-300" 
         />
         
         <div className="absolute bottom-4 right-4 flex gap-2">
            <button onClick={onStandardizeAll} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-all"><Maximize2 size={12} /> 1600 Std All</button>
            <button onClick={() => setShowEditor(true)} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all"><Wand2 size={12} /> AI Editor</button>
         </div>
      </div>

      <div className="flex flex-wrap gap-2">
         {allImages.map((img, i) => (
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
              
              {/* 缩略图操作层 */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex flex-col justify-between p-1 transition-opacity">
                 <div className="flex justify-between w-full">
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateField('main_image', img); setPreviewImage(img); }} 
                      className={`p-1 rounded-lg text-white transition-colors ${img === listing.cleaned.main_image ? 'bg-amber-500' : 'bg-white/20 hover:bg-amber-400'}`}
                      title="Set as Main"
                    >
                      <Star size={10} fill={img === listing.cleaned.main_image ? "currentColor" : "none"} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateField('other_images', (listing.cleaned.other_images || []).filter(u => u !== img)); }} 
                      className="p-1 bg-white/20 hover:bg-red-500 rounded-lg text-white transition-colors"
                      title="Remove Image"
                    >
                      <Trash2 size={10} />
                    </button>
                 </div>
                 
                 <button 
                  onClick={(e) => { e.stopPropagation(); onStandardizeOne(img); }} 
                  title="Standardize to 1600px"
                  className="w-5 h-5 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-400 transition-colors shadow-lg"
                 >
                   <Maximize2 size={10} />
                 </button>
              </div>

              {/* 列表处理中状态 */}
              {isProcessing && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                  <Loader2 size={12} className="animate-spin text-indigo-600" />
                </div>
              )}
           </div>
         ))}
         <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50 shrink-0"><Plus size={20} /></button>
      </div>
    </div>
  );
};
