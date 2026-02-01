
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
import { optimizeListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI } from '../services/openaiService';
import { optimizeListingWithDeepSeek } from '../services/deepseekService';

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onDelete: (id: string) => Promise<void>;
  onNext: () => void;
  uiLang: UILanguage;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onDelete, onNext, uiLang }) => {
  const [activeMarket, setActiveMarket] = useState('US');
  const [engine, setEngine] = useState<'gemini' | 'openai' | 'deepseek'>(() => (localStorage.getItem('amzbot_preferred_engine') as any) || 'gemini');
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
        setIsOptimizing(true);
        try {
          const opt = engine === 'openai' ? await optimizeListingWithOpenAI(localListing.cleaned) : engine === 'deepseek' ? await optimizeListingWithDeepSeek(localListing.cleaned) : await optimizeListingWithAI(localListing.cleaned);
          const next: Listing = { ...localListing, optimized: { ...opt, optimized_main_image: localListing.optimized?.optimized_main_image, optimized_other_images: localListing.optimized?.optimized_other_images }, status: 'optimized' as const };
          updateListingData(next);
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
                />
             </div>
          </div>
        </div>
      </div>

      {showImageEditor && (
        <ImageEditor imageUrl={editingImageUrl} onClose={() => setShowImageEditor(false)} onSave={(url) => {
          const next = JSON.parse(JSON.stringify(localListing));
          if ((next.optimized?.optimized_main_image || next.cleaned.main_image) === editingImageUrl) next.optimized = { ...(next.optimized || {}), optimized_main_image: url };
          else { const others = [...(next.optimized?.optimized_other_images || next.cleaned.other_images || [])]; const idx = others.indexOf(editingImageUrl); if (idx > -1) { others[idx] = url; next.optimized = { ...(next.optimized || {}), optimized_other_images: others }; } }
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
