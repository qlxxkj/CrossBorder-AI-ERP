
import React, { useState, useRef } from 'react';
import { Loader2, Maximize2, Wand2, Star, Trash2, Plus, RefreshCcw, Upload } from 'lucide-react';
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
  const [processingUrls, setProcessingUrls] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [hoverImage, setHoverImage] = useState<string | null>(null);

  const effectiveMain = listing.optimized?.optimized_main_image || listing.cleaned?.main_image || '';
  const effectiveOthers = listing.optimized?.optimized_other_images || listing.cleaned?.other_images || [];
  const allImages = [effectiveMain, ...effectiveOthers].filter(Boolean) as string[];

  const normalizeUrl = (raw: any): string => {
    const src = Array.isArray(raw) && raw[0]?.src ? raw[0].src : (raw.url || raw.data?.url || raw);
    if (!src || typeof src !== 'string') return "";
    return src.startsWith('http') ? src : `${IMAGE_HOST_DOMAIN}${src.startsWith('/') ? '' : '/'}${src}`;
  };

  const processAndUploadImage = async (imgUrl: string): Promise<string> => {
    if (!imgUrl) return "";
    setProcessingUrls(prev => { const n = new Set(prev); n.add(imgUrl); return n; });
    
    try {
      const proxiedUrl = (imgUrl.startsWith('data:') || imgUrl.startsWith('blob:')) 
        ? imgUrl 
        : `${CORS_PROXY}${encodeURIComponent(imgUrl)}&_t=${Date.now()}`;
      
      const img = new Image();
      img.crossOrigin = "anonymous"; 
      
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Physical Load Fail"));
        img.src = proxiedUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1600; canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF'; 
      ctx.fillRect(0, 0, 1600, 1600);
      
      const scale = Math.min(1500 / img.width, 1500 / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh);
      
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error("Canvas Fail");

      const fd = new FormData();
      fd.append('file', blob, `std_${Date.now()}.jpg`);
      
      const res = await fetch(TARGET_API, { method: 'POST', body: fd });
      const data = await res.json();
      return normalizeUrl(data) || imgUrl;
    } catch (e) {
      console.error("Standardize Failure:", e);
      return imgUrl;
    } finally {
      setProcessingUrls(prev => { const n = new Set(prev); n.delete(imgUrl); return n; });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(TARGET_API, { method: 'POST', body: fd });
      const data = await res.json();
      const url = normalizeUrl(data);
      if (url) {
        const nextOthers = [...effectiveOthers, url];
        onUpdateListing({ optimized: { ...listing.optimized, optimized_other_images: nextOthers } as any });
        setPreviewImage(url);
      }
    } catch (err) {
      alert("Upload error");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStandardizeAll = async () => {
    setIsProcessing(true);
    try {
      const newMain = effectiveMain ? await processAndUploadImage(effectiveMain) : "";
      const newOthers = [];
      for (const u of effectiveOthers) {
        newOthers.push(await processAndUploadImage(u));
      }
      onUpdateListing({ 
        optimized: { 
          ...(listing.optimized || {}), 
          optimized_main_image: newMain || effectiveMain, 
          optimized_other_images: newOthers 
        } as any 
      });
      if (newMain) setPreviewImage(newMain);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStandardizeOne = async (url: string) => {
    const newUrl = await processAndUploadImage(url);
    const nextOpt = { ...(listing.optimized || {}) };
    if (effectiveMain === url) {
      nextOpt.optimized_main_image = newUrl;
      setPreviewImage(newUrl);
    } else {
      const others = [...effectiveOthers];
      const idx = others.indexOf(url);
      if (idx > -1) {
        others[idx] = newUrl;
        nextOpt.optimized_other_images = others;
      }
      if (previewImage === url) setPreviewImage(newUrl);
    }
    onUpdateListing({ optimized: nextOpt as any });
  };

  const handleSetAsMain = (targetUrl: string) => {
    if (targetUrl === effectiveMain) return;
    
    // 逻辑：将当前主图移入 other_images，将点击的图片设为 optimized_main_image
    const currentOthers = [...effectiveOthers];
    const filteredOthers = currentOthers.filter(u => u !== targetUrl);
    
    onUpdateListing({
      optimized: {
        ...(listing.optimized || {}),
        optimized_main_image: targetUrl,
        optimized_other_images: [effectiveMain, ...filteredOthers].filter(Boolean)
      } as any
    });
    setPreviewImage(targetUrl);
  };

  const handleRemoveImage = (targetUrl: string) => {
    if (!window.confirm("Remove this image?")) return;
    if (targetUrl === effectiveMain) {
      const [first, ...rest] = effectiveOthers;
      onUpdateListing({
        optimized: {
          ...(listing.optimized || {}),
          optimized_main_image: first || '',
          optimized_other_images: rest
        } as any
      });
      if (first) setPreviewImage(first);
    } else {
      onUpdateListing({
        optimized: {
          ...(listing.optimized || {}),
          optimized_other_images: effectiveOthers.filter(u => u !== targetUrl)
        } as any
      });
    }
  };

  const activeDisplayImage = hoverImage || previewImage;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
      <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group mb-6">
         {(isSaving || isProcessing) && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>}
         <img src={activeDisplayImage} className="max-w-full max-h-full object-contain transition-all duration-300" />
         <div className="absolute bottom-4 right-4 flex gap-2">
            <button onClick={() => onUpdateListing({ optimized: undefined })} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase shadow-sm flex items-center gap-2 hover:bg-slate-200 border border-slate-200"><RefreshCcw size={12} /> Restore</button>
            <button onClick={handleStandardizeAll} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 hover:bg-indigo-700 shadow-indigo-200"><Maximize2 size={12} /> Standardize All</button>
            <button onClick={() => openEditor(previewImage)} className="px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all"><Wand2 size={12} /> AI Editor</button>
         </div>
      </div>
      <div className="flex flex-wrap gap-2">
         {allImages.map((img, i) => {
           const isSelfProcessing = processingUrls.has(img);
           const isMain = img === effectiveMain;
           return (
             <div key={`${img}-${i}`} onMouseEnter={() => setHoverImage(img)} onMouseLeave={() => setHoverImage(null)} onClick={() => setPreviewImage(img)} className={`group/thumb relative w-16 h-16 rounded-xl border-2 shrink-0 cursor-pointer overflow-hidden transition-all ${previewImage === img ? 'border-indigo-500 shadow-lg scale-105 z-10' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}>
                <img src={img} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-black/40 flex flex-col justify-between p-1 transition-opacity ${isSelfProcessing ? 'opacity-100' : 'opacity-0 group-hover/thumb:opacity-100'}`}>
                   <div className="flex justify-between w-full">
                      <button onClick={(e) => { e.stopPropagation(); handleSetAsMain(img); }} className={`p-1 rounded-lg text-white transition-colors ${isMain ? 'bg-amber-500 shadow-lg' : 'bg-white/20 hover:bg-amber-400'}`} title="Set as Main"><Star size={10} fill={isMain ? "currentColor" : "none"} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(img); }} className="p-1 bg-white/20 hover:bg-red-500 rounded-lg text-white"><Trash2 size={10} /></button>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); handleStandardizeOne(img); }} className="w-5 h-5 flex items-center justify-center bg-indigo-600 text-white rounded-lg shadow-lg self-start hover:bg-indigo-400">
                     {isSelfProcessing ? <Loader2 size={10} className="animate-spin" /> : <Maximize2 size={10} />}
                   </button>
                </div>
             </div>
           );
         })}
         <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50">
            <Upload size={20} />
         </button>
         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      </div>
    </div>
  );
};
