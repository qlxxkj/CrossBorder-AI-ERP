
import React, { useState, useRef } from 'react';
import { Loader2, Maximize2, Wand2, Star, Trash2, Plus, RefreshCcw } from 'lucide-react';
import { Listing } from '../types';

interface ListingImageSectionProps {
  listing: Listing;
  previewImage: string;
  setPreviewImage: (url: string) => void;
  onUpdateListing: (updates: Partial<Listing>) => void;
  isSaving: boolean;
  openEditor: (url: string) => void;
}

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';

export const ListingImageSection: React.FC<ListingImageSectionProps> = ({
  listing, previewImage, setPreviewImage, onUpdateListing, isSaving, openEditor
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingUrls, setProcessingUrls] = useState<Set<string>>(new Set());
  const [hoverImage, setHoverImage] = useState<string | null>(null);

  const effectiveMain = listing.optimized?.optimized_main_image || listing.cleaned?.main_image || '';
  const effectiveOthers = listing.optimized?.optimized_other_images || listing.cleaned?.other_images || [];
  const allImages = [effectiveMain, ...effectiveOthers].filter(Boolean) as string[];

  const processAndUploadImage = async (imgUrl: string): Promise<string> => {
    if (!imgUrl) return "";
    setProcessingUrls(prev => { const n = new Set(prev); n.add(imgUrl); return n; });
    try {
      const proxied = (imgUrl.startsWith('data:') || imgUrl.startsWith('blob:')) 
        ? imgUrl : `${CORS_PROXY}${encodeURIComponent(imgUrl)}`;
      
      const response = await fetch(proxied);
      const blob = await response.blob();
      const localObjUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = localObjUrl;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = 1600; canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1600, 1600);
      
      const scale = Math.min(1500 / img.width, 1500 / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh);
      
      URL.revokeObjectURL(localObjUrl);
      
      return new Promise((resolve) => {
        canvas.toBlob(async (outBlob) => {
          if (!outBlob) { setProcessingUrls(p => { const n = new Set(p); n.delete(imgUrl); return n; }); return resolve(imgUrl); }
          const fd = new FormData(); fd.append('file', outBlob, `std1600_${Date.now()}.jpg`);
          try {
            const res = await fetch(TARGET_API, { method: 'POST', body: fd });
            const data = await res.json();
            const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
            const finalUrl = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : imgUrl;
            setProcessingUrls(p => { const n = new Set(p); n.delete(imgUrl); return n; });
            resolve(finalUrl);
          } catch (e) { setProcessingUrls(p => { const n = new Set(p); n.delete(imgUrl); return n; }); resolve(imgUrl); }
        }, 'image/jpeg', 0.98);
      });
    } catch (e) { setProcessingUrls(p => { const n = new Set(p); n.delete(imgUrl); return n; }); return imgUrl; }
  };

  const handleStandardizeAll = async () => {
    setIsProcessing(true);
    const processedMain = effectiveMain ? await processAndUploadImage(effectiveMain) : "";
    const processedOthers = [];
    for (const u of effectiveOthers) { processedOthers.push(await processAndUploadImage(u)); }
    
    const nextOpt = { 
      ...(listing.optimized || {}), 
      optimized_main_image: processedMain || effectiveMain, 
      optimized_other_images: processedOthers 
    };
    onUpdateListing({ optimized: nextOpt as any });
    if (processedMain) setPreviewImage(processedMain);
    setIsProcessing(false);
  };

  const handleStandardizeOne = async (url: string) => {
    const newUrl = await processAndUploadImage(url);
    const nextOpt = JSON.parse(JSON.stringify(listing.optimized || {}));
    if (effectiveMain === url) {
      nextOpt.optimized_main_image = newUrl;
    } else {
      const others = [...effectiveOthers];
      const idx = others.indexOf(url);
      if (idx > -1) { others[idx] = newUrl; nextOpt.optimized_other_images = others; }
    }
    onUpdateListing({ optimized: nextOpt });
    if (previewImage === url) setPreviewImage(newUrl);
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsProcessing(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(TARGET_API, { method: 'POST', body: fd });
      const data = await res.json();
      const rawSrc = Array.isArray(data) && data[0]?.src ? data[0].src : data.url;
      const url = rawSrc ? (rawSrc.startsWith('http') ? rawSrc : `${IMAGE_HOST_DOMAIN}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`) : null;
      if (url) {
        const currentOthers = listing.optimized?.optimized_other_images || listing.cleaned.other_images || [];
        onUpdateListing({ optimized: { ...(listing.optimized || {}), optimized_other_images: [...currentOthers, url] } as any });
        setPreviewImage(url);
      }
    } finally { setIsProcessing(false); if (e.target) e.target.value = ''; }
  };

  const handleSetMain = (url: string) => {
    const others = allImages.filter(u => u !== url);
    onUpdateListing({ optimized: { ...(listing.optimized || {}), optimized_main_image: url, optimized_other_images: others } as any });
    setPreviewImage(url);
  };

  const handleRemoveImage = (url: string) => {
    const isMain = url === effectiveMain;
    const nextAll = allImages.filter(u => u !== url);
    if (isMain) {
       onUpdateListing({ optimized: { ...(listing.optimized || {}), optimized_main_image: nextAll[0] || "", optimized_other_images: nextAll.slice(1) } as any });
       setPreviewImage(nextAll[0] || "");
    } else {
       onUpdateListing({ optimized: { ...(listing.optimized || {}), optimized_other_images: nextAll.filter(u => u !== effectiveMain) } as any });
    }
  };

  const handleRestoreAll = () => {
    const nextOpt = { ...listing.optimized };
    delete nextOpt.optimized_main_image; delete nextOpt.optimized_other_images;
    onUpdateListing({ optimized: nextOpt as any });
    setPreviewImage(listing.cleaned.main_image || '');
  };

  const activeDisplayImage = hoverImage || previewImage;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
         {(isSaving || isProcessing) && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>}
         <img src={activeDisplayImage} className="max-w-full max-h-full object-contain transition-all duration-300" />
         <div className="absolute bottom-4 right-4 flex gap-2">
            <button onClick={handleRestoreAll} disabled={isProcessing} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase shadow-sm flex items-center gap-2 hover:bg-slate-200 transition-all border border-slate-200 disabled:opacity-30"><RefreshCcw size={12} /> Restore Original</button>
            <button onClick={handleStandardizeAll} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-indigo-200"><Maximize2 size={12} /> Standardize All</button>
            <button onClick={() => openEditor(previewImage)} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all"><Wand2 size={12} /> AI Editor</button>
         </div>
      </div>
      <div className="flex flex-wrap gap-2">
         {allImages.map((img, i) => {
           const isSelfProcessing = processingUrls.has(img);
           return (
             <div key={`${img}-${i}`} onMouseEnter={() => setHoverImage(img)} onMouseLeave={() => setHoverImage(null)} onClick={() => setPreviewImage(img)} className={`group/thumb relative w-16 h-16 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden transition-all ${previewImage === img ? 'border-indigo-500 shadow-lg scale-105 z-10' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}>
                <img src={img} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-black/40 flex flex-col justify-between p-1 transition-opacity ${isSelfProcessing ? 'opacity-100' : 'opacity-0 group-hover/thumb:opacity-100'}`}>
                   <div className="flex justify-between w-full">
                      <button onClick={(e) => { e.stopPropagation(); handleSetMain(img); }} className={`p-1 rounded-lg text-white transition-colors ${img === effectiveMain ? 'bg-amber-50' : 'bg-white/20 hover:bg-amber-400'}`}><Star size={10} fill={img === effectiveMain ? "currentColor" : "none"} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(img); }} className="p-1 bg-white/20 hover:bg-red-500 rounded-lg text-white transition-colors"><Trash2 size={10} /></button>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); handleStandardizeOne(img); }} className="w-5 h-5 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-400 shadow-lg self-start">
                     {isSelfProcessing ? <Loader2 size={10} className="animate-spin" /> : <Maximize2 size={10} />}
                   </button>
                </div>
             </div>
           );
         })}
         <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50 shrink-0">
           {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={20} />}
         </button>
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAddImage} />
      </div>
    </div>
  );
};
