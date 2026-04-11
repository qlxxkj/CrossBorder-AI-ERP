
import React, { useState, useEffect } from 'react';
import { Listing, UILanguage, SourcingRecord } from '../types';
import { ListingTopBar } from './ListingTopBar';
import { ListingImageSection } from './ListingImageSection';
import { ListingSourcingSection } from './ListingSourcingSection';
import { ListingEditorArea } from './ListingEditorArea';
import { ImageEditor } from './ImageEditor';
import { SourcingModal } from './SourcingModal';
import { SourcingFormModal } from './SourcingFormModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { checkUserCredits, deductCreditsByTokens } from '../lib/creditService';
import { optimizeListingProxy } from '../services/aiProxyService';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onDelete: (id: string) => Promise<void>;
  onNext: () => void;
  uiLang: UILanguage;
  onRefreshProfile?: () => void;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onDelete, onNext, uiLang, onRefreshProfile }) => {
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<'gemini' | 'openai' | 'deepseek' | 'qwen'>(() => (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string>(''); 
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState(false);
  const [editingSourceRecord, setEditingSourceRecord] = useState<SourcingRecord | null>(null);
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [previewImage, setPreviewImage] = useState<string>('');

  useEffect(() => { 
    setLocalListing(listing); 
    const initialImg = listing.optimized?.optimized_main_image || listing.cleaned?.main_image || '';
    setPreviewImage(initialImg); 
    localStorage.setItem('amzbot_preferred_engine', engine);
  }, [listing.id, engine]);

  const syncToSupabase = async (targetListing: Listing) => {
    if (!isSupabaseConfigured()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('listings').update({
        cleaned: targetListing.cleaned,
        optimized: targetListing.optimized || null,
        translations: targetListing.translations || null,
        status: targetListing.status,
        sourcing_data: targetListing.sourcing_data || [],
        updated_at: new Date().toISOString()
      }).eq('id', targetListing.id);
      if (error) throw error;
    } catch (e) { console.error("Sync Error:", e); } 
    finally { setIsSaving(false); }
  };

  const updateListingData = (updates: Partial<Listing>) => {
    const next = { ...localListing, ...updates };
    setLocalListing(next);
    onUpdate(next);
    syncToSupabase(next);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      <ListingTopBar onBack={onBack} engine={engine} setEngine={setEngine} onOptimize={async () => {
        if (!localListing.user_id) {
          alert(uiLang === 'zh' ? "无法获取用户信息，请重新登录" : "User info missing, please re-login");
          return;
        }
        
        setIsOptimizing(true);
        try {
          // 1. Pre-check credits
          const creditRes = await checkUserCredits(localListing.user_id);
          if (!creditRes.success) {
            alert(uiLang === 'zh' ? `积分不足: ${creditRes.message}` : creditRes.message);
            return;
          }

          // 2. Fetch infringement words
          const { data: infringementWordsData } = await supabase
            .from('infringement_words')
            .select('word')
            .eq('org_id', localListing.org_id);
          const infringementWords = (infringementWordsData || []).map(bw => bw.word.trim()).filter(Boolean);

          // 2.5 Pre-optimization infringement check
          let cleaned = { ...localListing.cleaned };
          let hasInfringement = false;

          const escapeRegExp = (string: string) => {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          };
          
          const removeWords = (text: string) => {
            if (!text) return text;
            let newText = text;
            infringementWords.forEach(word => {
              const escapedWord = escapeRegExp(word);
              const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
              if (regex.test(newText)) {
                newText = newText.replace(regex, '').replace(/\s\s+/g, ' ').trim();
                hasInfringement = true;
              }
            });
            return newText;
          };

          if (cleaned.title) cleaned.title = removeWords(cleaned.title);
          if (cleaned.description) cleaned.description = removeWords(cleaned.description);
          if (cleaned.bullet_points && Array.isArray(cleaned.bullet_points)) {
            cleaned.bullet_points = cleaned.bullet_points.map(bp => removeWords(bp));
          }

          if (hasInfringement) {
            // Update local state and DB before AI optimization to save tokens
            const updatedListing = { ...localListing, cleaned };
            setLocalListing(updatedListing);
            await supabase.from('listings').update({ cleaned }).eq('id', localListing.id);
          }

          // 3. Perform AI optimization
          const res = await optimizeListingProxy(engine, cleaned, infringementWords);
          const opt = res.data; 
          const tokens = res.tokens;

          // 4. Deduct credits based on tokens
          await deductCreditsByTokens(localListing.user_id, tokens, engine, 'optimization');
          if (onRefreshProfile) onRefreshProfile();

          const next: Listing = { 
            ...localListing, 
            optimized: { 
              ...opt, 
              optimized_main_image: localListing.optimized?.optimized_main_image, 
              optimized_other_images: localListing.optimized?.optimized_other_images 
            }, 
            status: 'optimized' as const 
          };
          updateListingData(next);
        } catch (err: any) {
          alert("Optimization failed: " + err.message);
        } finally { setIsOptimizing(false); }
      }} isOptimizing={isOptimizing} onSave={() => syncToSupabase(localListing)} onDelete={() => onDelete(localListing.id)} isSaving={isSaving} onNext={onNext} uiLang={uiLang} />
      
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-20">
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-0">
             <ListingImageSection 
               listing={localListing} 
               previewImage={previewImage} 
               setPreviewImage={setPreviewImage} 
               onUpdateListing={updateListingData}
               isSaving={isSaving}
               openEditor={(url) => { setEditingImageUrl(url); setShowImageEditor(true); }}
             />
             <ListingSourcingSection 
               listing={localListing} 
               updateField={(f, v) => updateListingData({ [f]: v })} 
               setShowModal={setShowSourcingModal} 
               setShowForm={setShowSourcingForm} 
               setEditingRecord={setEditingSourceRecord} 
             />
          </div>
          <div className="lg:col-span-8 space-y-6">
             <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <ListingEditorArea 
                  listing={localListing} 
                  activeMarket={activeMarket} 
                  setActiveMarket={setActiveMarket}
                  updateListing={updateListingData}
                  onSync={() => syncToSupabase(localListing)} 
                  engine={engine}
                  uiLang={uiLang} 
                  onRefreshProfile={onRefreshProfile}
                />
             </div>
          </div>
        </div>
      </div>

      {showImageEditor && (
        <ImageEditor imageUrl={editingImageUrl} onClose={() => setShowImageEditor(false)} onSave={(url) => {
          const next = JSON.parse(JSON.stringify(localListing));
          if ((next.optimized?.optimized_main_image || next.cleaned.main_image) === editingImageUrl) {
            next.optimized = { ...(next.optimized || {}), optimized_main_image: url };
          } else {
            const others = [...(next.optimized?.optimized_other_images || next.cleaned.other_images || [])];
            const idx = others.indexOf(editingImageUrl);
            if (idx > -1) {
              others[idx] = url;
              next.optimized = { ...(next.optimized || {}), optimized_other_images: others };
            }
          }
          setPreviewImage(url);
          updateListingData(next);
          setShowImageEditor(false);
        }} uiLang={uiLang} />
      )}
      
      {showSourcingModal && <SourcingModal productImage={previewImage} onClose={() => setShowSourcingModal(false)} onAddLink={(rec) => { updateListingData({ sourcing_data: [...(localListing.sourcing_data || []), rec] }); setShowSourcingModal(false); }} />}
      {showSourcingForm && <SourcingFormModal initialData={editingSourceRecord} onClose={() => setShowSourcingForm(false)} onSave={(rec) => { const cur = localListing.sourcing_data || []; const next = editingSourceRecord ? cur.map(s => s.id === editingSourceRecord.id ? rec : s) : [...cur, rec]; updateListingData({ sourcing_data: next }); setShowSourcingForm(false); }} />}
    </div>
  );
};
