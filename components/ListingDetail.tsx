
import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, Sparkles, Copy, ShoppingCart, Search, 
  Image as ImageIcon, Edit2, Trash2, Plus, X,
  Link as LinkIcon, Trash, BrainCircuit, Globe, Languages, Download, Loader2,
  Upload, DollarSign, Truck, Info, Settings2
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI } from '../services/openaiService';
import { ImageEditor } from './ImageEditor';
import { SourcingModal } from './SourcingModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';

// 图床基础配置
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
// 使用 CORS Proxy 解决浏览器直接请求图床报 CORS 错误的问题
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

  // 上传图片工具函数：支持 Base64
  const uploadToHost = async (source: File | string): Promise<string> => {
    let fileToUpload: File;

    if (typeof source === 'string') {
      // 如果是 Base64，转换为 File
      const res = await fetch(source);
      const blob = await res.blob();
      fileToUpload = new File([blob], `edited_${Date.now()}.jpg`, { type: 'image/jpeg' });
    } else {
      fileToUpload = source;
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);

    const response = await fetch(IMAGE_HOSTING_API, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Upload failed with status: ${response.status}`);
    
    const data = await response.json();
    if (Array.isArray(data) && data[0]?.src) {
      return `${IMAGE_HOST_DOMAIN}${data[0].src}`;
    } else if (data.url || data.link || data.data?.url) {
      return data.url || data.link || data.data?.url;
    }
    
    throw new Error('No image URL found in server response.');
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
      console.error("Upload Error:", error);
      alert(`上传失败: ${error.message}`);
    } finally {
      setIsUploadingLocal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      let optimizedData: OptimizedData;
      if (aiProvider === 'gemini') {
        optimizedData = await optimizeListingWithAI(localListing.cleaned);
      } else {
        optimizedData = await optimizeListingWithOpenAI(localListing.cleaned);
      }
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
      const updated = {
        ...localListing,
        translations: {
          ...(localListing.translations || {}),
          [mktCode]: translated
        }
      };
      updateAndSync(updated);
      setActiveMarketplace(mktCode);
    } catch (error: any) {
      alert(`Translation failed: ${error.message}`);
    } finally {
      setIsTranslating(null);
    }
  };

  const exportAmazonTemplate = () => {
    const content = currentContent || localListing.optimized || { 
      optimized_title: localListing.cleaned.title,
      optimized_features: localListing.cleaned.features,
      optimized_description: localListing.cleaned.description,
      search_keywords: ''
    };
    
    const headers = ["SKU", "ASIN", "Title", "Price", "Bullet1", "Bullet2", "Bullet3", "Bullet4", "Bullet5", "Description", "Keywords"];
    const row = [
      `SKU-${localListing.asin}`,
      localListing.asin,
      content.optimized_title,
      localListing.cleaned.price.toString(),
      ...(content.optimized_features || []).slice(0, 5),
      content.optimized_description,
      content.search_keywords
    ];

    const csvContent = [headers, row].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Amazon_Listing_${localListing.asin}_${activeMarketplace}.csv`;
    link.click();
  };

  const handleFieldChange = (path: string, value: any) => {
    const updated = JSON.parse(JSON.stringify(localListing));
    const keys = path.split('.');
    let current: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    setLocalListing(updated);
  };

  const handleBlur = () => updateAndSync(localListing);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleLocalFileSelect}
      />

      {isEditorOpen && (
        <ImageEditor 
          imageUrl={selectedImage} 
          onClose={() => setIsEditorOpen(false)} 
          onSave={async (base64) => {
            try {
              // 步骤1：上传 Base64 到图床获取真实 URL
              const uploadedUrl = await uploadToHost(base64);

              // 步骤2：更新本地数据结构
              const currentImages = [localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])];
              const idx = currentImages.indexOf(selectedImage);
              
              if (idx !== -1) {
                currentImages[idx] = uploadedUrl;
              }

              const updated = { ...localListing };
              updated.cleaned.main_image = currentImages[0];
              updated.cleaned.other_images = currentImages.slice(1);
              
              setSelectedImage(uploadedUrl);
              updateAndSync(updated);
              setIsEditorOpen(false);
            } catch (err: any) {
              alert("保存编辑并上传失败：" + err.message);
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
          <button onClick={exportAmazonTemplate} className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            <Download size={16} /> {t('exportAmazon')}
          </button>
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
              <span className="flex items-center gap-2"><ImageIcon size={18} className="text-blue-500" /> Gallery</span>
              <div className="flex gap-3">
                 <button onClick={() => setShowAddImage(!showAddImage)} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                   <LinkIcon size={12} /> URL
                 </button>
                 <button onClick={() => fileInputRef.current?.click()} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                   <Plus size={12} /> Local
                 </button>
              </div>
            </h3>
            
            {showAddImage && (
              <div className="mb-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
                <input 
                  type="text" 
                  placeholder="Paste image URL..." 
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="flex-1 p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={handleAddImage} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Add</button>
              </div>
            )}

            <div className="relative aspect-square rounded-xl bg-slate-50 border border-slate-100 overflow-hidden mb-4 group shadow-inner">
              <img src={selectedImage} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" alt="Main" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => setIsEditorOpen(true)} className="px-4 py-2 bg-white text-slate-900 rounded-lg font-bold text-xs shadow-xl flex items-center gap-2 hover:bg-slate-50"><Edit2 size={14} /> AI Studio</button>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {[localListing.cleaned.main_image, ...(localListing.cleaned.other_images || [])].map((img, i) => (
                <div key={i} className={`relative aspect-square rounded-lg border-2 group/item cursor-pointer transition-all ${selectedImage === img ? 'border-blue-500 scale-95 shadow-inner' : 'border-slate-100 hover:border-slate-300'}`}>
                  <img src={img} onClick={() => setSelectedImage(img)} className="w-full h-full object-cover rounded" alt={`Thumbnail ${i}`} />
                  <button 
                    onClick={(e) => handleDeleteImage(img, e)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity z-10 shadow-sm"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLocal}
                className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all bg-slate-50 group/upload"
              >
                {isUploadingLocal ? <Loader2 className="animate-spin" size={16} /> : <Plus size={20} className="group-hover/upload:scale-125 transition-transform" />}
                <span className="text-[8px] font-black uppercase mt-1">Upload</span>
              </button>
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

             {/* 价格与运费编辑区 */}
             <div className="p-6 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 size={14} className="text-blue-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pricing & Logistics</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <DollarSign size={10} /> Selling Price (USD)
                    </label>
                    <div className="relative group">
                      <input 
                        type="number"
                        step="0.01"
                        value={localListing.cleaned.price}
                        onChange={(e) => handleFieldChange('cleaned.price', parseFloat(e.target.value) || 0)}
                        onBlur={handleBlur}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Truck size={10} /> Shipping Fee (USD)
                    </label>
                    <div className="relative group">
                      <input 
                        type="number"
                        step="0.01"
                        value={localListing.cleaned.shipping || 0}
                        onChange={(e) => handleFieldChange('cleaned.shipping', parseFloat(e.target.value) || 0)}
                        onBlur={handleBlur}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>
             </div>

             {currentContent ? (
               <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase">Optimized Title</label>
                    <textarea 
                      value={currentContent.optimized_title}
                      onChange={(e) => {
                        if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_title', e.target.value);
                        else handleFieldChange(`translations.${activeMarketplace}.optimized_title`, e.target.value);
                      }}
                      onBlur={handleBlur}
                      className="w-full p-3 bg-indigo-50/10 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] leading-relaxed"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-500 uppercase">Backend Search Keywords</label>
                    <input 
                      value={currentContent.search_keywords}
                      onChange={(e) => {
                        if (activeMarketplace === 'en') handleFieldChange('optimized.search_keywords', e.target.value);
                        else handleFieldChange(`translations.${activeMarketplace}.optimized_keywords`, e.target.value);
                      }}
                      onBlur={handleBlur}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                      placeholder="comma, separated, keywords..."
                    />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                       <label className="text-[10px] font-bold text-indigo-400 uppercase">Feature Bullet Points</label>
                       {currentContent.optimized_features.map((f, i) => (
                         <div key={i} className="flex gap-2 group/bullet">
                           <span className="flex-none w-6 h-8 flex items-center justify-center text-[10px] font-bold text-slate-300">{i+1}</span>
                           <input 
                             value={f}
                             onChange={(e) => {
                                const next = [...currentContent.optimized_features];
                                next[i] = e.target.value;
                                if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_features', next);
                                else handleFieldChange(`translations.${activeMarketplace}.optimized_features`, next);
                             }}
                             onBlur={handleBlur}
                             className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs group-hover/bullet:border-indigo-200 outline-none transition-colors"
                           />
                         </div>
                       ))}
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-indigo-400 uppercase">Detailed Description</label>
                       <textarea 
                         value={currentContent.optimized_description}
                         onChange={(e) => {
                           if (activeMarketplace === 'en') handleFieldChange('optimized.optimized_description', e.target.value);
                           else handleFieldChange(`translations.${activeMarketplace}.optimized_description`, e.target.value);
                         }}
                         onBlur={handleBlur}
                         className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs min-h-[300px] leading-relaxed"
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
