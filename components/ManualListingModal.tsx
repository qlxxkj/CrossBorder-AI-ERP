
import React, { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2, Loader2, Save, Image as ImageIcon } from 'lucide-react';
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
  const [formData, setFormData] = useState<Partial<CleanedData>>({
    asin: '',
    title: '',
    brand: '',
    price: 0,
    description: '',
    features: [''],
    main_image: '',
    other_images: []
  });

  const uploadToHost = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(IMAGE_HOSTING_API, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Upload failed`);
    const data = await response.json();
    // Use response format logic from ListingDetail
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
        setFormData(prev => ({ ...prev, other_images: [...(prev.other_images || []), url] }));
      }
    } catch (err: any) {
      alert("Image upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.asin || !formData.title || !formData.main_image) {
      alert("Please fill in ASIN, Title and upload a Main Image.");
      return;
    }

    if (!isSupabaseConfigured()) {
      alert("Supabase not configured.");
      return;
    }

    setIsLoading(true);
    try {
      const newListing = {
        asin: formData.asin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'collected',
        cleaned: {
          ...formData,
          features: formData.features?.filter(f => f.trim() !== '') || []
        }
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
    setFormData(prev => ({ ...prev, features: [...(prev.features || []), ''] }));
  };

  const updateFeature = (idx: number, val: string) => {
    const next = [...(formData.features || [])];
    next[idx] = val;
    setFormData(prev => ({ ...prev, features: next }));
  };

  const removeImage = (img: string, isMain: boolean) => {
    if (isMain) {
      setFormData(prev => ({ ...prev, main_image: '' }));
    } else {
      setFormData(prev => ({ ...prev, other_images: prev.other_images?.filter(i => i !== img) }));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Plus className="text-indigo-600" /> {t('addListing')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Left Column: Basic Info */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('asinLabel')}</label>
                  <input 
                    type="text" 
                    value={formData.asin}
                    onChange={(e) => setFormData(prev => ({ ...prev, asin: e.target.value }))}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="e.g. B0XXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('priceLabel')}</label>
                  <input 
                    type="number" 
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('titleLabel')}</label>
                <textarea 
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('brandLabel')}</label>
                <input 
                  type="text" 
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('descLabel')}</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-600 min-h-[150px]"
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
                <div className="relative aspect-square rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden group">
                  {formData.main_image ? (
                    <>
                      <img src={formData.main_image} className="w-full h-full object-contain" alt="Main" />
                      <button 
                        onClick={() => removeImage('', true)}
                        className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => mainImageInputRef.current?.click()}
                      disabled={isUploading}
                      className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
                    >
                      {isUploading ? <Loader2 className="animate-spin" /> : <Upload size={32} className="mb-2" />}
                      <span className="text-xs font-black uppercase tracking-widest">{t('uploading').includes('...') ? (isUploading ? t('uploading') : t('uploadMain')) : (isUploading ? 'Uploading...' : 'Upload')}</span>
                    </button>
                  )}
                  <input type="file" ref={mainImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />
                </div>
              </div>

              {/* Gallery Images */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   Gallery Images
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {formData.other_images?.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-xl bg-slate-50 border border-slate-100 overflow-hidden group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button 
                        onClick={() => removeImage(img, false)}
                        className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => otherImagesInputRef.current?.click()}
                    disabled={isUploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50"
                  >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={20} />}
                  </button>
                  <input type="file" ref={otherImagesInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, false)} />
                </div>
              </div>

              {/* Features Tags */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feature Bullets</label>
                  <button onClick={addFeature} className="text-xs font-black text-indigo-600 hover:underline">+ Add Bullet</button>
                </div>
                <div className="space-y-2">
                  {formData.features?.map((f, i) => (
                    <div key={i} className="flex gap-2">
                       <input 
                         type="text" 
                         value={f}
                         onChange={(e) => updateFeature(i, e.target.value)}
                         className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium"
                         placeholder={`Feature ${i+1}`}
                       />
                       <button 
                        onClick={() => {
                          const next = formData.features?.filter((_, idx) => idx !== i);
                          setFormData(prev => ({ ...prev, features: next }));
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                       >
                         <X size={14} />
                       </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
          >
            {t('cancel')}
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading || isUploading}
            className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all flex items-center gap-2 disabled:opacity-50"
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
