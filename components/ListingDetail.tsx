
import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, Sparkles, Copy, ShoppingCart, Search, 
  Image as ImageIcon, Edit2, Trash2, Plus, X,
  Link as LinkIcon, Trash, BrainCircuit, Globe, Languages, Download, Loader2,
  Upload, DollarSign, Truck, Info, Settings2, GripVertical
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI } from '../services/openaiService';
import { ImageEditor } from './ImageEditor';
import { SourcingModal } from './SourcingModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

// Limits for Amazon/E-commerce standards
const LIMITS = {
  TITLE: 200,
  BULLET: 500,
  DESCRIPTION: 2000,
  KEYWORDS: 250
};

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  uiLang: UILanguage;
}

const MARKETPLACES = [
  { code: 'en', name: 'USA/UK', flag: '🇺🇸' },
  { code: 'fr', name: 'France', flag: '🇫🇷' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'it', name: 'Italy', flag: '🇮🇹' },
  { code: 'es', name: 'Spain', flag: '🇪🇸' },
  { code: 'nl', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'se', name: 'Sweden', flag: '🇸🇪' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵' },
];

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, uiLang }) => {
  const t = useTranslation(uiLang);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [selectedImage, setSelectedImage] = useState<string>(listing.cleaned.main_image);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSourcingOpen, setIsSourcingOpen] = useState(false);
  const [activeMarketplace, setActiveMarketplace] = useState<string>('en');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showAddImage, setShowAddImage] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const currentContent = activeMarketplace === 'en' 
    ? (localListing.optimized || null)
    : (localListing.translations?.[activeMarketplace] || null);

  const syncToSupabase = async (updatedListing: Listing) => {
    if (!isSupabaseConfigured()) return;
    try {
      const { error } = await supabase.from('listings').update({
        cleaned: updatedListing.cleaned,
        optimized: updatedListing.optimized,
        translations: updatedListing.translations,
        status: updatedListing.status
      }).eq('id', updatedListing.id);
      
      if (error) throw error;
    } catch (e) {
      console.error("Sync to Supabase failed:", e);
    }
  };

  const updateAndSync = (updated: Listing) => {
    setLocalListing(updated);
    onUpdate(updated);
    syncToSupabase(updated);
  };

  const uploadToHost = async (source: File | string): Promise<string> => {
    let fileToUpload: File;
    if (typeof source === 'string') {
      const res = await fetch(source);
      const blob = await res.blob();
      fileToUpload = new File([blob], `edited_${Date.now()}.jpg`, { type: 'image/jpeg' });
    } else {
      fileToUpload = source;
    }
    const formData = new FormData();
    formData.append('file', fileToUpload);
    const response = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Upload failed`);
    const data = await response.json();
    return Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
  };

  // --- Image Reordering Logic ---
  const allImages = [localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])];

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null) return;
    const newImages = [...allImages];
    const item = newImages.splice(draggedIdx, 1)[0];
    newImages.splice(targetIdx, 0, item);
    
    const updated = { ...localListing };
    updated.cleaned.main_image = newImages[0];
    updated.cleaned.other_images = newImages.slice(1);
    
    updateAndSync(updated);
    setDraggedIdx(null);
  };

  const handleAddImage = () => {
    if (!newImageUrl) return;
    const updated = { ...localListing };
    if (!updated.cleaned.other_images) updated.cleaned.other_images = [];
    updated.cleaned.other_images.push(newImageUrl);
    updateAndSync(updated);
    setNewImageUrl('');
    setShowAddImage(false);
  };

  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLocal(true);
    try {
      const uploadedUrl = await uploadToHost(file);
      const updated = { ...localListing };
      if (!updated.cleaned.other_images) updated.cleaned.other_images = [];
      updated.cleaned.other_images.push(uploadedUrl);
      updateAndSync(updated);
      setSelectedImage(uploadedUrl); 
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploadingLocal(false);
    }
  };

  const handleDeleteImage = (img: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this image?")) return;
    const updated = { ...localListing };
    if (img === updated.cleaned.main_image) {
      if (updated.cleaned.other_images && updated.cleaned.other_images.length > 0) {
        updated.cleaned.main_image = updated.cleaned.other_images[0];
        updated.cleaned.other_images = updated.cleaned.other_images.slice(1);
      } else {
        alert("Cannot delete the only image.");
        return;
      }
    } else {
      updated.cleaned.other_images = updated.cleaned.other_images?.filter(i => i !== img);
    }
    if (selectedImage === img) setSelectedImage(updated.cleaned.main_image);
    updateAndSync(updated);
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let optimizedData = aiProvider === 'gemini' 
        ? await optimizeListingWithAI(localListing.cleaned)
        : await optimizeListingWithOpenAI(localListing.cleaned);
      const updated = { ...localListing, status: 'optimized' as const, optimized: optimizedData };
      updateAndSync(updated);
    } catch (error: any) {
      alert(`Optimization failed: ${error.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleTranslate = async (mktCode: string) => {
    if (!localListing.optimized) {
      alert("Please optimize in English first.");
      return;
    }
    setIsTranslating(mktCode);
    try {
      const translated = await translateListingWithAI(localListing.optimized, mktCode);
      const updated = { ...localListing, translations: { ...(localListing.translations || {}), [mktCode]: translated } };
      updateAndSync(updated);
      setActiveMarketplace(mktCode);
    } catch (error: any) {
      alert(`Translation failed: ${error.message}`);
    } finally {
      setIsTranslating(null);
    }
  };

  const handleFieldChange = (path: string, value: any) => {
    const updated = JSON.parse(JSON.stringify(localListing));
    const keys = path.split('.');
    let current: any = updated;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
    setLocalListing(updated);
  };

  const handleBlur = () => updateAndSync(localListing);

  // --- Bullet Point Management ---
  const addBullet = () => {
    if (!currentContent) return;
    const next = [...currentContent.optimized_features, ""];
    if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_features', next);
    else handleFieldChange(`translations.${activeMarketplace}.optimized_features`, next);
    handleBlur();
  };

  const removeBullet = (idx: number) => {
    if (!currentContent) return;
    const next = currentContent.optimized_features.filter((_, i) => i !== idx);
    if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_features', next);
    else handleFieldChange(`translations.${activeMarketplace}.optimized_features`, next);
    handleBlur();
  };

  const CharCounter = ({ count, limit }: { count: number, limit: number }) => (
    <span className={`text-[10px] font-bold ${count > limit ? 'text-red-500' : 'text-slate-400'}`}>
      {count} / {limit}
    </span>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLocalFileSelect} />

      {isEditorOpen && (
        <ImageEditor 
          imageUrl={selectedImage} 
          onClose={() => setIsEditorOpen(false)} 
          onSave={async (base64) => {
            try {
              const uploadedUrl = await uploadToHost(base64);
              const currentImages = [localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])];
              const idx = currentImages.indexOf(selectedImage);
              if (idx !== -1) currentImages[idx] = uploadedUrl;
              const updated = { ...localListing };
              updated.cleaned.main_image = currentImages[0];
              updated.cleaned.other_images = currentImages.slice(1);
              setSelectedImage(uploadedUrl);
              updateAndSync(updated);
              setIsEditorOpen(false);
            } catch (err: any) {
              alert("Save failed: " + err.message);
            }
          }}
        />
      )}

      {isSourcingOpen && (
        <SourcingModal 
          productImage={localListing.cleaned.main_image} 
          onClose={() => setIsSourcingOpen(false)}
          onAddLink={(link) => {
            const updated = { ...localListing };
            if (!updated.cleaned.sourcing_links) updated.cleaned.sourcing_links = [];
            if (!updated.cleaned.sourcing_links.includes(link)) {
              updated.cleaned.sourcing_links.push(link);
              updateAndSync(updated);
            }
            setIsSourcingOpen(false);
          }}
        />
      )}

      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-40">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800 font-medium transition-colors">
          <ArrowLeft size={20} className="mr-2" /> {t('back')}
        </button>
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setAiProvider('gemini')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiProvider === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Gemini</button>
            <button onClick={() => setAiProvider('openai')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${aiProvider === 'openai' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>GPT-4o</button>
          </div>
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50">
            {isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {t('aiOptimize')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><ImageIcon size={18} className="text-blue-500" /> Gallery (Drag to Sort)</span>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </h3>
            
            <div className="relative aspect-square rounded-xl bg-slate-50 border border-slate-100 overflow-hidden mb-4 group shadow-inner">
              <img src={selectedImage} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" alt="Main" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => setIsEditorOpen(true)} className="px-4 py-2 bg-white text-slate-900 rounded-lg font-bold text-xs shadow-xl flex items-center gap-2 hover:bg-slate-50"><Edit2 size={14} /> AI Studio</button>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {allImages.map((img, i) => (
                <div 
                  key={i} 
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(i)}
                  className={`relative aspect-square rounded-lg border-2 group/item cursor-move transition-all ${
                    selectedImage === img ? 'border-blue-500 scale-95' : 'border-slate-100 hover:border-slate-300'
                  } ${draggedIdx === i ? 'opacity-20' : ''}`}
                >
                  <img src={img} onClick={() => setSelectedImage(img)} className="w-full h-full object-cover rounded pointer-events-none" alt={`Thumbnail ${i}`} />
                  {i === 0 && <div className="absolute top-0 left-0 bg-blue-500 text-[8px] font-black text-white px-1 py-0.5 rounded-br uppercase">Main</div>}
                  <button onClick={(e) => handleDeleteImage(img, e)} className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity z-10 shadow-sm">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Languages size={18} className="text-purple-500" /> {t('translateMarketplace')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {MARKETPLACES.map(m => (
                <button 
                  key={m.code}
                  onClick={() => localListing.translations?.[m.code] || m.code === 'en' ? setActiveMarketplace(m.code) : handleTranslate(m.code)}
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs font-bold transition-all ${
                    activeMarketplace === m.code 
                      ? 'border-purple-500 bg-purple-50 text-purple-700' 
                      : (localListing.translations?.[m.code] || m.code === 'en' ? 'border-slate-200 text-slate-600 hover:border-purple-300' : 'border-dashed border-slate-200 text-slate-400 hover:border-slate-300')
                  }`}
                >
                  <span>{m.flag} {m.name}</span>
                  {isTranslating === m.code && <Loader2 size={12} className="animate-spin" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
             <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Edit2 size={12} /> Listing Editor ({MARKETPLACES.find(m => m.code === activeMarketplace)?.name})
                </h4>
             </div>

             {currentContent ? (
               <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                 <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Optimized Title</label>
                      <CharCounter count={currentContent.optimized_title.length} limit={LIMITS.TITLE} />
                    </div>
                    <textarea 
                      value={currentContent.optimized_title}
                      onChange={(e) => {
                        if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_title', e.target.value);
                        else handleFieldChange(`translations.${activeMarketplace}.optimized_title`, e.target.value);
                      }}
                      onBlur={handleBlur}
                      className={`w-full p-3 bg-indigo-50/10 border ${currentContent.optimized_title.length > LIMITS.TITLE ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'} rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] leading-relaxed transition-all`}
                    />
                 </div>

                 <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Backend Search Keywords</label>
                      <CharCounter count={currentContent.search_keywords.length} limit={LIMITS.KEYWORDS} />
                    </div>
                    <input 
                      value={currentContent.search_keywords}
                      onChange={(e) => {
                        if (activeMarketplace === 'en') handleFieldChange('optimized.search_keywords', e.target.value);
                        else handleFieldChange(`translations.${activeMarketplace}.optimized_keywords`, e.target.value);
                      }}
                      onBlur={handleBlur}
                      className={`w-full p-3 bg-slate-50 border ${currentContent.search_keywords.length > LIMITS.KEYWORDS ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'} rounded-xl text-xs font-mono transition-all`}
                      placeholder="comma, separated, keywords..."
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <div className="flex justify-between items-center">
                         <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Feature Bullet Points</label>
                         <button onClick={addBullet} className="text-[10px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1">
                           <Plus size={10} /> Add Point
                         </button>
                       </div>
                       <div className="space-y-4">
                         {currentContent.optimized_features.map((f, i) => (
                           <div key={i} className="space-y-1 animate-in fade-in slide-in-from-top-2">
                             <div className="flex justify-between items-center px-1">
                               <span className="text-[9px] font-bold text-slate-400">Point {i+1}</span>
                               <div className="flex items-center gap-2">
                                 <CharCounter count={f.length} limit={LIMITS.BULLET} />
                                 <button onClick={() => removeBullet(i)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                               </div>
                             </div>
                             <textarea 
                               value={f}
                               onChange={(e) => {
                                  const next = [...currentContent.optimized_features];
                                  next[i] = e.target.value;
                                  if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_features', next);
                                  else handleFieldChange(`translations.${activeMarketplace}.optimized_features`, next);
                               }}
                               onBlur={handleBlur}
                               className={`w-full p-2 bg-slate-50 border ${f.length > LIMITS.BULLET ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'} rounded-lg text-xs outline-none transition-all focus:ring-1 focus:ring-indigo-500 min-h-[60px]`}
                             />
                           </div>
                         ))}
                       </div>
                    </div>

                    <div className="space-y-1">
                       <div className="flex justify-between items-center">
                         <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Detailed Description</label>
                         <CharCounter count={currentContent.optimized_description.length} limit={LIMITS.DESCRIPTION} />
                       </div>
                       <textarea 
                         value={currentContent.optimized_description}
                         onChange={(e) => {
                           if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_description', e.target.value);
                           else handleFieldChange(`translations.${activeMarketplace}.optimized_description`, e.target.value);
                         }}
                         onBlur={handleBlur}
                         className={`w-full p-4 bg-slate-50 border ${currentContent.optimized_description.length > LIMITS.DESCRIPTION ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'} rounded-xl text-xs min-h-[400px] leading-relaxed transition-all focus:ring-2 focus:ring-indigo-500 outline-none`}
                       />
                    </div>
                 </div>
               </div>
             ) : (
               <div className="p-20 text-center flex flex-col items-center justify-center gap-4 flex-1">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <BrainCircuit size={32} />
                  </div>
                  <p className="text-slate-400 font-medium italic text-center leading-relaxed">
                    Run "AI Optimize" to generate high-converting content<br/>or select a marketplace to start editing.
                  </p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
