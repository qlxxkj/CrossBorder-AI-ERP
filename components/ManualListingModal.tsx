
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
    if (!formData.title.trim()) {
      alert(uiLang === 'zh' ? "请填写产品标题" : "Please fill in Product Title.");
      return;
    }
    if (!formData.main_image) {
      alert(uiLang === 'zh' ? "请上传主图" : "Please upload a Main Image.");
      return;
    }

    if (!isSupabaseConfigured()) {
      alert("Supabase not configured.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(uiLang === 'zh' ? "会话已过期，请重新登录" : "Session expired. Please log in again.");

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

      const { error } = await supabase.from('listings').insert([{
        user_id: session.user.id, 
        asin: cleanedData.asin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'collected',
        cleaned: cleanedData
      }]);
      
      if (error) throw error;
      onSave();
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('asinLabel')}</label>
                  <input type="text" value={formData.asin} onChange={(e) => setFormData(p => ({ ...p, asin: e.target.value }))} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold" placeholder="e.g. B0XXXXXX" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('brandLabel')}</label>
                  <input type="text" value={formData.brand} onChange={(e) => setFormData(p => ({ ...p, brand: e.target.value }))} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('titleLabel')}</label>
                <textarea value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px] font-bold leading-relaxed" placeholder="Enter product title..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('priceLabel')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" value={formData.price || ''} onChange={(e) => setFormData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('shippingLabel')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" value={formData.shipping || ''} onChange={(e) => setFormData(p => ({ ...p, shipping: parseFloat(e.target.value) || 0 }))} className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold" />
                  </div>
                </div>
              </div>

              {/* 彻底分栏，解决重叠问题 */}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Weight size={12}/> {t('weightLabel')}</label>
                  <div className="flex gap-2">
                    <input type="number" value={formData.weightValue} onChange={(e) => setFormData(p => ({ ...p, weightValue: e.target.value }))} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" placeholder="0.00" />
                    <select value={formData.weightUnit} onChange={(e) => setFormData(p => ({ ...p, weightUnit: e.target.value }))} className="w-24 px-2 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase cursor-pointer">
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Ruler size={12}/> {t('dimensionsLabel')}</label>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="relative">
                      <input type="number" placeholder="L" value={formData.dimL} onChange={(e) => setFormData(p => ({ ...p, dimL: e.target.value }))} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold" />
                      <span className="absolute -bottom-4 left-0 w-full text-center text-[8px] text-slate-300 font-black">LONG</span>
                    </div>
                    <div className="relative">
                      <input type="number" placeholder="W" value={formData.dimW} onChange={(e) => setFormData(p => ({ ...p, dimW: e.target.value }))} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold" />
                      <span className="absolute -bottom-4 left-0 w-full text-center text-[8px] text-slate-300 font-black">WIDE</span>
                    </div>
                    <div className="relative">
                      <input type="number" placeholder="H" value={formData.dimH} onChange={(e) => setFormData(p => ({ ...p, dimH: e.target.value }))} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold" />
                      <span className="absolute -bottom-4 left-0 w-full text-center text-[8px] text-slate-300 font-black">HIGH</span>
                    </div>
                    <select value={formData.dimUnit} onChange={(e) => setFormData(p => ({ ...p, dimUnit: e.target.value }))} className="w-full px-1 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase cursor-pointer">
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('descLabel')}</label>
                <textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 min-h-[120px] leading-relaxed" />
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14} /> {t('uploadMain')}</label>
                <div className="relative aspect-square rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden group shadow-inner">
                  {formData.main_image ? (
                    <>
                      <img src={formData.main_image} className="w-full h-full object-contain p-4" alt="Main" />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button onClick={() => setFormData(p => ({ ...p, main_image: '' }))} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest">Delete Main</button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => mainImageInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                      {isUploading ? <Loader2 className="animate-spin text-indigo-500" size={32} /> : <Upload size={32} className="mb-2" />}
                      <span className="text-xs font-black uppercase tracking-widest">{isUploading ? t('uploading') : 'Click to upload'}</span>
                    </button>
                  )}
                  <input type="file" ref={mainImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gallery Images (Max 9)</label>
                <div className="grid grid-cols-4 gap-3">
                  {formData.other_images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden group shadow-sm">
                      <img src={img} className="w-full h-full object-cover" alt={`Gallery ${i}`} />
                      <button onClick={() => setFormData(p => ({ ...p, other_images: p.other_images.filter(x => x !== img) }))} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  {formData.other_images.length < 9 && (
                    <button onClick={() => otherImagesInputRef.current?.click()} disabled={isUploading} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50">
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={24} />}
                    </button>
                  )}
                  <input type="file" ref={otherImagesInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, false)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">{t('cancel')}</button>
          <button onClick={handleSave} disabled={isLoading || isUploading} className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all flex items-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isLoading ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
