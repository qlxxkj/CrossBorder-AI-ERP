
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
const IMAGE_PROXY = 'https://images.weserv.nl/?url=';
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
    const src = Array.isArray(raw) ? raw[0]?.src : (raw.url || raw.data?.url || raw.src || raw);
    if (!src || typeof src !== 'string') return "";
    return src.startsWith('http') ? src : `${IMAGE_HOST_DOMAIN}${src.startsWith('/') ? '' : '/'}${src}`;
  };

  const processAndUploadImage = async (imgUrl: string): Promise<string> => {
    if (!imgUrl) return "";
    setProcessingUrls(prev => { const n = new Set(prev); n.add(imgUrl); return n; });
    
    try {
      const cleanUrl = imgUrl.split('?')[0]; 
      const proxiedUrl = `${IMAGE_PROXY}${encodeURIComponent(cleanUrl)}`;
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => { img.onerror = reject; img.src = cleanUrl; };
        img.src = proxiedUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1600; canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      
      // 核心修复：绘制纯白底图防止透明底
      ctx.fillStyle = '#FFFFFF'; 
      ctx.fillRect(0, 0, 1600, 1600);
      
      // 开启高质量缩放
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const scale = Math.min(1500 / img.width, 1500 / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (1600 - dw) / 2, (1600 - dh) / 2, dw, dh);
      
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
      if (!blob) throw new Error("Canvas Error");

      const fd = new FormData();
      fd.append('file', blob, `std_${Date.now()}.jpg`);
      
      // 核心修复：通过代理转发解决 CORS 问题
      const proxiedUploadUrl = `${CORS_PROXY}${encodeURIComponent(TARGET_API)}`;
      const uploadRes = await fetch(proxiedUploadUrl, { method: 'POST', body: fd });
      if (!uploadRes.ok) throw new Error("Upload Failed");
      
      const data = await uploadRes.json();
      const finalUrl = normalizeUrl(data);
      
      return finalUrl ? `${finalUrl}?std=${Date.now()}` : imgUrl;
    } catch (e) {
      console.error("Standardize Failed:", e);
      return imgUrl;
    } finally {
      setProcessingUrls(prev => { const n = new Set(prev); n.delete(imgUrl); return n; });
    }
  };

  const handleStandardizeAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const newMain = effectiveMain ? await processAndUploadImage(effectiveMain) : "";
      const newOthers = [];
      for (const u of effectiveOthers) {
        newOthers.push(await processAndUploadImage(u));
      }
      
      const nextOpt = JSON.parse(JSON.stringify(listing.optimized || {}));
      nextOpt.optimized_main_image = newMain || effectiveMain;
      nextOpt.optimized_other_images = newOthers;
      
      onUpdateListing({ optimized: nextOpt });
      if (newMain) setPreviewImage(newMain);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStandardizeOne = async (url: string) => {
    const newUrl = await processAndUploadImage(url);
    const nextOpt = JSON.parse(JSON.stringify(listing.optimized || {}));
    
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
    onUpdateListing({ optimized: nextOpt });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const proxiedUploadUrl = `${CORS_PROXY}${encodeURIComponent(TARGET_API)}`;
      const res = await fetch(proxiedUploadUrl, { method: 'POST', body: fd });
      const data = await res.json();
      const url = normalizeUrl(data);
      if (url) {
        const nextOpt = JSON.parse(JSON.stringify(listing.optimized || {}));
        nextOpt.optimized_other_images = [...(nextOpt.optimized_other_images || []), url];
        onUpdateListing({ optimized: nextOpt });
        setPreviewImage(url);
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSetAsMain = (targetUrl: string) => {
    if (targetUrl === effectiveMain) return;
    const currentOthers = [...effectiveOthers];
    const filteredOthers = currentOthers.filter(u => u !== targetUrl);
    const nextOpt = JSON.parse(JSON.stringify(listing.optimized || {}));
    nextOpt.optimized_main_image = targetUrl;
    nextOpt.optimized_other_images = [effectiveMain, ...filteredOthers].filter(Boolean);
    onUpdateListing({ optimized: nextOpt });
    setPreviewImage(targetUrl);
  };

  const activeDisplayImage = hoverImage || previewImage;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
      <div className="aspect-square bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden relative flex items-center justify-center group">
         {(isSaving || isProcessing) && <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 gap-3">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">Syncing...</span>
         </div>}
         <img src={activeDisplayImage} className="max-w-full max-h-full object-contain transition-all duration-300" />
         
         <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
            <button onClick={() => { onUpdateListing({ optimized: undefined }); setPreviewImage(listing.cleaned.main_image || ''); }} className="px-3 py-2 bg-white/90 backdrop-blur-md text-slate-500 rounded-xl text-[9px] font-black uppercase shadow-lg flex items-center gap-1.5 hover:bg-slate-100 border border-white transition-all"><RefreshCcw size={12} /> Restore</button>
            <button onClick={handleStandardizeAll} disabled={isProcessing} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-xl flex items-center gap-1.5 hover:bg-indigo-700 transition-all active:scale-95"><Maximize2 size={12} /> Standardize All</button>
            <button onClick={() => openEditor(previewImage)} className="px-3 py-2 bg-white/90 backdrop-blur-md text-indigo-600 rounded-xl text-[9px] font-black uppercase shadow-lg flex items-center gap-1.5 border border-white hover:bg-indigo-50 transition-all"><Wand2 size={12} /> Studio</button>
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
                      <button onClick={(e) => { e.stopPropagation(); onUpdateListing({ optimized: { ...(listing.optimized || {}), optimized_other_images: effectiveOthers.filter(u => u !== img) } as any }); }} className="p-1 bg-white/20 hover:bg-red-500 rounded-lg text-white"><Trash2 size={10} /></button>
                   </div>
                   <button onClick={(e) => { e.stopPropagation(); handleStandardizeOne(img); }} className="w-5 h-5 flex items-center justify-center bg-indigo-600 text-white rounded-lg shadow-lg self-start hover:bg-indigo-400 transition-colors">
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
