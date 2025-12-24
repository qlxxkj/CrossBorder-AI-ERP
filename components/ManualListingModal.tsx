
import React, { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2, Loader2, Save, Image as ImageIcon, Ruler, Weight } from 'lucide-react';
import { UILanguage, CleanedData } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface ManualListingModalProps {
  uiLang: UILanguage;
  onClose: () => void;
  onSave: () => void;
}

const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

export const ManualListingModal: React.FC<ManualListingModalProps> = ({ uiLang, onClose, onSave }) => {
  const t = useTranslation(uiLang);
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const otherImagesInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // 扩展表单字段
  const [formData, setFormData] = useState({
    asin: '',
    title: '',
    brand: '',
    price: 0,
    shipping: 0,
    description: '',
    features: [''],
    main_image: '',
    other_images: [] as string[],
    weightValue: '',
    weightUnit: 'kg',
    dimL: '',
    dimW: '',
    dimH: '',
    dimUnit: 'cm'
  });

  const uploadToHost = async (file: File): Promise<string> => {
    const formDataBody = new FormData();
    formDataBody.append('file', file);
    const response = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formDataBody });
    if (!response.ok) throw new Error(`Upload failed`);
    const data = await response.json();
    return Array.isArray(data) && data[0]?.src ? `${IMAGE_HOST_DOMAIN}${data[0].src}` : data.url;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMain: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToHost(file);
      if (isMain) {
        setFormData(prev => ({ ...prev, main_image: url }));
      } else {
        setFormData(prev => ({ ...prev, other_images: [...prev.other_images, url] }));
      }
    } catch (err: any) {
      alert("Image upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    // 修复校验逻辑：ASIN 不再是必填项，Title 和 main_image 是必填项
    if (!formData.title.trim() || !formData.main_image) {
      alert(uiLang === 'zh' ? "请填写产品标题并上传主图" : "Please fill in Product Title and upload a Main Image.");
      return;
    }

    if (!isSupabaseConfigured()) {
      alert("Supabase not configured.");
      return;
    }

    setIsLoading(true);
    try {
      const cleanedData: CleanedData = {
        asin: formData.asin || `MANUAL-${Date.now()}`,
        title: formData.title,
        brand: formData.brand,
        price: formData.price,
        shipping: formData.shipping,
        description: formData.description,
        features: formData.features.filter(f => f.trim() !== ''),
        main_image: formData.main_image,
        other_images: formData.other_images,
        item_weight: formData.weightValue ? `${formData.weightValue} ${formData.weightUnit}` : '',
        product_dimensions: (formData.dimL && formData.dimW && formData.dimH) 
          ? `${formData.dimL} x ${formData.dimW} x ${formData.dimH} ${formData.dimUnit}` 
          : '',
      };

      const newListing = {
        asin: cleanedData.asin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'collected',
        cleaned: cleanedData
      };

      const { error } = await supabase.from('listings').insert([newListing]);
      if (error) throw error;
      onSave();
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addFeature = () => {
    setFormData(prev => ({ ...prev, features: [...prev.features, ''] }));
  };

  const updateFeature = (idx: number, val: string) => {
    const next = [...formData.features];
    next[idx] = val;
    setFormData(prev => ({ ...prev, features: next }));
  };

  const removeImage = (img: string, isMain: boolean) => {
    if (isMain) {
      setFormData(prev => ({ ...prev, main_image: '' }));
    } else {
      setFormData(prev => ({ ...prev, other_images: prev.other_images.filter(i => i !== img) }));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Plus size={24} />
            </div>
            {t('addListing')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('asinLabel')}</label>
                  <input 
                    type="text" 
                    value={formData.asin}
                    onChange={(e) => setFormData(prev => ({ ...prev, asin: e.target.value }))}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="e.g. B0XXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('brandLabel')}</label>
                  <input 
                    type="text" 
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('titleLabel')}</label>
                <textarea 
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 min-h-[100px] leading-relaxed"
                  placeholder="Enter high-converting product title..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('priceLabel')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('shippingLabel')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      value={formData.shipping || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Weight size={12}/> {t('weightLabel')}</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={formData.weightValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, weightValue: e.target.value }))}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none"
                      placeholder="0.00"
                    />
                    <select 
                      value={formData.weightUnit}
                      onChange={(e) => setFormData(prev => ({ ...prev, weightUnit: e.target.value }))}
                      className="w-20 px-2 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase"
                    >
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Ruler size={12}/> {t('dimensionsLabel')}</label>
                  <div className="flex gap-1 items-center">
                    <input type="number" placeholder="L" value={formData.dimL} onChange={(e) => setFormData(p => ({ ...p, dimL: e.target.value }))} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-bold" />
                    <span className="text-slate-300">×</span>
                    <input type="number" placeholder="W" value={formData.dimW} onChange={(e) => setFormData(p => ({ ...p, dimW: e.target.value }))} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-bold" />
                    <span className="text-slate-300">×</span>
                    <input type="number" placeholder="H" value={formData.dimH} onChange={(e) => setFormData(p => ({ ...p, dimH: e.target.value }))} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-bold" />
                    <select value={formData.dimUnit} onChange={(e) => setFormData(p => ({ ...p, dimUnit: e.target.value }))} className="w-16 px-1 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase">
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                      <option value="mm">mm</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('descLabel')}</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-600 min-h-[120px] leading-relaxed"
                />
              </div>
            </div>

            {/* Right Column: Media */}
            <div className="space-y-8">
              {/* Main Image */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon size={14} /> {t('uploadMain')}
                </label>
                <div className="relative aspect-square rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden group shadow-inner">
                  {formData.main_image ? (
                    <>
                      <img src={formData.main_image} className="w-full h-full object-contain p-4" alt="Main" />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button 
                          onClick={() => removeImage('', true)}
                          className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-red-700 transition-all"
                        >
                          <Trash2 size={16} /> Delete Main
                        </button>
                      </div>
                    </>
                  ) : (
                    <button 
                      onClick={() => mainImageInputRef.current?.click()}
                      disabled={isUploading}
                      className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{t('uploading')}</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 border border-slate-100">
                            <Upload size={32} />
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest">Click to upload main image</span>
                        </>
                      )}
                    </button>
                  )}
                  <input type="file" ref={mainImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />
                </div>
              </div>

              {/* Gallery Images */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   Gallery Images (Max 9)
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {formData.other_images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden group shadow-sm">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button 
                        onClick={() => removeImage(img, false)}
                        className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {formData.other_images.length < 9 && (
                    <button 
                      onClick={() => otherImagesInputRef.current?.click()}
                      disabled={isUploading}
                      className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50 hover:bg-white group/btn"
                    >
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={24} className="group-hover/btn:rotate-90 transition-transform" />}
                    </button>
                  )}
                  <input type="file" ref={otherImagesInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, false)} />
                </div>
              </div>

              {/* Features Tags */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feature Bullets</label>
                  <button onClick={addFeature} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest border border-indigo-100 px-3 py-1 rounded-full">+ Add Bullet</button>
                </div>
                <div className="space-y-3">
                  {formData.features.map((f, i) => (
                    <div key={i} className="flex gap-2 animate-in slide-in-from-top-1">
                       <input 
                         type="text" 
                         value={f}
                         onChange={(e) => updateFeature(i, e.target.value)}
                         className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                         placeholder={`Feature Highlight ${i+1}`}
                       />
                       <button 
                        onClick={() => {
                          const next = formData.features.filter((_, idx) => idx !== i);
                          setFormData(prev => ({ ...prev, features: next }));
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-xl border border-slate-100"
                       >
                         <Trash2 size={14} />
                       </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading || isUploading}
            className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isLoading ? t('saving') : t('save')}
          </button>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};
