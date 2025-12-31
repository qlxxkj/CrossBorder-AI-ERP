
import React, { useState, useRef } from 'react';
import { X, Upload, Plus, Trash2, Loader2, Save, Image as ImageIcon, Ruler, Weight, ListFilter, Search, Info, Globe, FileText } from 'lucide-react';
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

const MARKETPLACES = [
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'UK', name: 'UK', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
];

export const ManualListingModal: React.FC<ManualListingModalProps> = ({ uiLang, onClose, onSave }) => {
  const t = useTranslation(uiLang);
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const otherImagesInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    asin: '',
    marketplace: 'US',
    title: '',
    brand: '',
    price: 0,
    shipping: 0,
    description: '',
    features: ['', '', '', '', ''],
    search_keywords: '',
    weightValue: '',
    weightUnit: 'kg',
    dimL: '',
    dimW: '',
    dimH: '',
    dimUnit: 'cm',
    main_image: '',
    other_images: [] as string[]
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

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    if (formData.features.length >= 10) return;
    setFormData(prev => ({ ...prev, features: [...prev.features, ''] }));
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, features: newFeatures }));
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
      if (!session) throw new Error(uiLang === 'zh' ? "会话已过期，请重新登录" : "Session expired.");

      const cleanedData: CleanedData = {
        asin: formData.asin || `MANUAL-${Date.now()}`,
        title: formData.title,
        brand: formData.brand,
        price: formData.price,
        shipping: formData.shipping,
        description: formData.description,
        features: formData.features.filter(f => f.trim() !== ''),
        search_keywords: formData.search_keywords,
        main_image: formData.main_image,
        other_images: formData.other_images,
        item_weight: formData.weightValue ? `${formData.weightValue} ${formData.weightUnit}` : '',
        item_weight_value: formData.weightValue,
        item_weight_unit: formData.weightUnit,
        item_length: formData.dimL,
        item_width: formData.dimW,
        item_height: formData.dimH,
        item_size_unit: formData.dimUnit,
        product_dimensions: (formData.dimL && formData.dimW && formData.dimH) 
          ? `${formData.dimL} x ${formData.dimW} x ${formData.dimH} ${formData.dimUnit}` 
          : '',
      };

      const { error } = await supabase.from('listings').insert([{
        user_id: session.user.id, 
        asin: cleanedData.asin,
        marketplace: formData.marketplace,
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
      <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
              <Plus size={24} />
            </div>
            {uiLang === 'zh' ? '手动录入产品数据' : 'Manual Data Entry'}
          </h2>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Market & ASIN</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Marketplace</label>
                    <div className="relative">
                      <select 
                        value={formData.marketplace}
                        onChange={(e) => setFormData(p => ({ ...p, marketplace: e.target.value }))}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold appearance-none cursor-pointer focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      >
                        {MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.name}</option>)}
                      </select>
                      <Globe className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('asinLabel')}</label>
                    <input type="text" value={formData.asin} onChange={(e) => setFormData(p => ({ ...p, asin: e.target.value }))} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold" placeholder="B0XXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('brandLabel')}</label>
                    <input type="text" value={formData.brand} onChange={(e) => setFormData(p => ({ ...p, brand: e.target.value }))} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('priceLabel')}</label>
                      <input type="number" value={formData.price || ''} onChange={(e) => setFormData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('shippingLabel')}</label>
                      <input type="number" value={formData.shipping || ''} onChange={(e) => setFormData(p => ({ ...p, shipping: parseFloat(e.target.value) || 0 }))} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Logistics Specs</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><Weight size={12}/> {t('weightLabel')}</label>
                    <div className="flex gap-2 w-full">
                      <input 
                        type="number" 
                        value={formData.weightValue} 
                        onChange={(e) => setFormData(p => ({ ...p, weightValue: e.target.value }))} 
                        className="flex-1 min-w-0 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" 
                        placeholder="0.00" 
                      />
                      <select 
                        value={formData.weightUnit} 
                        onChange={(e) => setFormData(p => ({ ...p, weightUnit: e.target.value }))} 
                        className="w-24 shrink-0 px-2 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase"
                      >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><Ruler size={12}/> {t('dimensionsLabel')}</label>
                    <div className="grid grid-cols-4 gap-2">
                      <input type="number" placeholder="L" value={formData.dimL} onChange={(e) => setFormData(p => ({ ...p, dimL: e.target.value }))} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold" />
                      <input type="number" placeholder="W" value={formData.dimW} onChange={(e) => setFormData(p => ({ ...p, dimW: e.target.value }))} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold" />
                      <input type="number" placeholder="H" value={formData.dimH} onChange={(e) => setFormData(p => ({ ...p, dimH: e.target.value }))} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold" />
                      <select value={formData.dimUnit} onChange={(e) => setFormData(p => ({ ...p, dimUnit: e.target.value }))} className="w-full px-1 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase">
                        <option value="cm">cm</option>
                        <option value="in">in</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-5 space-y-8">
              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('titleLabel')}</h3>
                  <span className={`text-[10px] font-black ${formData.title.length > 200 ? 'text-red-500' : 'text-slate-300'}`}>{formData.title.length}/200</span>
                </div>
                <textarea 
                  value={formData.title} 
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px] font-bold leading-relaxed text-slate-800" 
                  placeholder="Brand + Series + Key Features..." 
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2"><ListFilter size={14} /> Product Features</h3>
                    <button onClick={addFeature} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Plus size={16} /></button>
                  </div>
                  <div className="space-y-3">
                    {formData.features.map((feature, idx) => (
                      <div key={idx} className="group flex items-start gap-3">
                        <div className="mt-4 w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[8px] font-black text-slate-400 flex-shrink-0">{idx + 1}</div>
                        <textarea 
                          value={feature}
                          onChange={(e) => updateFeature(idx, e.target.value)}
                          placeholder={`Bullet Point ${idx + 1}...`}
                          className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-300 outline-none transition-all min-h-[60px]"
                        />
                        <button onClick={() => removeFeature(idx)} className="mt-4 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2"><FileText size={14} /> Product Description</h3>
                  </div>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Enter full product description..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-300 outline-none transition-all min-h-[150px]"
                  />
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2"><Search size={14} /> Backend Search Keywords</h3>
                  <textarea 
                    value={formData.search_keywords}
                    onChange={(e) => setFormData(p => ({ ...p, search_keywords: e.target.value }))}
                    placeholder="Enter comma separated keywords..."
                    className="w-full px-6 py-4 bg-amber-50/30 border border-amber-100 rounded-3xl text-xs font-bold text-slate-600 focus:bg-white focus:border-amber-400 outline-none transition-all min-h-[80px]"
                  />
                </div>
              </section>
            </div>

            <div className="lg:col-span-3 space-y-8">
              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('uploadMain')}</h3>
                <div className="relative aspect-square rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden group shadow-inner">
                  {formData.main_image ? (
                    <>
                      <img src={formData.main_image} className="w-full h-full object-contain p-4" alt="Main" />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button onClick={() => setFormData(p => ({ ...p, main_image: '' }))} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">Delete</button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => mainImageInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                      {isUploading ? <Loader2 className="animate-spin text-indigo-500" size={32} /> : <Upload size={32} className="mb-2" />}
                      <span className="text-[9px] font-black uppercase tracking-widest">{isUploading ? t('uploading') : 'Upload Main'}</span>
                    </button>
                  )}
                  <input type="file" ref={mainImageInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gallery (Max 9)</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {formData.other_images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-xl bg-slate-50 border border-slate-200 overflow-hidden group">
                        <img src={img} className="w-full h-full object-cover" alt={`Gallery ${i}`} />
                        <button onClick={() => setFormData(p => ({ ...p, other_images: p.other_images.filter(x => x !== img) }))} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {formData.other_images.length < 9 && (
                      <button onClick={() => otherImagesInputRef.current?.click()} disabled={isUploading} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50">
                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={20} />}
                      </button>
                    )}
                    <input type="file" ref={otherImagesInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, false)} />
                  </div>
                </div>
              </section>

              <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-200 text-white space-y-6">
                <button 
                  onClick={handleSave} 
                  disabled={isLoading || isUploading} 
                  className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isLoading ? t('saving') : t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
