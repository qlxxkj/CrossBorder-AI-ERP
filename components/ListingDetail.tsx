
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Sparkles, Image as ImageIcon, Edit2, Trash2, Plus, X,
  BrainCircuit, Globe, Languages, Loader2, DollarSign, Truck, Settings2, ZoomIn, Save, ChevronRight,
  Zap, Check, AlertCircle, Weight, Ruler, Coins, ListFilter, FileText, Wand2, Star, Upload, Search, ExternalLink, Link2, Maximize2, Edit3
} from 'lucide-react';
import { Listing, OptimizedData, CleanedData, UILanguage, PriceAdjustment, ExchangeRate, SourcingRecord, UserProfile } from '../types';
import { optimizeListingWithAI, translateListingWithAI } from '../services/geminiService';
import { optimizeListingWithOpenAI, translateListingWithOpenAI } from '../services/openaiService';
import { optimizeListingWithDeepSeek, translateListingWithDeepSeek } from '../services/deepseekService';
import { ImageEditor } from './ImageEditor';
import { SourcingModal } from './SourcingModal';
import { SourcingFormModal } from './SourcingFormModal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useTranslation } from '../lib/i18n';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';

const LIMITS = { TITLE: 200, BULLET: 500, DESCRIPTION: 2000, KEYWORDS: 250 };
const IMAGE_HOST_DOMAIN = 'https://img.hmstu.eu.org';
const TARGET_API = `${IMAGE_HOST_DOMAIN}/upload`; 
const CORS_PROXY = 'https://corsproxy.io/?';
const IMAGE_HOSTING_API = CORS_PROXY + encodeURIComponent(TARGET_API);

const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

const formatNum = (val: any) => {
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? '0' : parseFloat(n.toFixed(2)).toString();
};

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  onUpdate: (updatedListing: Listing) => void;
  onNext: () => void;
  uiLang: UILanguage;
}

type AIProvider = 'gemini' | 'openai' | 'deepseek';

// 定义点数消耗规则
const CREDIT_COSTS: Record<AIProvider, number> = {
  gemini: 3,
  openai: 2,
  deepseek: 1
};

export const ListingDetail: React.FC<ListingDetailProps> = ({ listing, onBack, onUpdate, onNext, uiLang }) => {
  const t = useTranslation(uiLang);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>(() => {
    const saved = localStorage.getItem('app_ai_provider') as AIProvider;
    return saved || 'gemini';
  });
  
  const [localListing, setLocalListing] = useState<Listing>(listing);
  const [selectedImage, setSelectedImage] = useState<string>(listing.cleaned?.main_image || '');
  const [activeMarketplace, setActiveMarketplace] = useState<string>('US'); 
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);

  useEffect(() => {
    localStorage.setItem('app_ai_provider', aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    fetchPricingData();
  }, []);

  const fetchPricingData = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.from('exchange_rates').select('*');
    if (data) setExchangeRates(data);
  };

  const checkAndConsumeCredit = async (provider: AIProvider): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const cost = CREDIT_COSTS[provider];
    if (!profile || (profile.credits_total - profile.credits_used) < cost) {
      alert(uiLang === 'zh' ? `余额不足。使用 ${provider} 需要 ${cost} 点，请前往财务中心升级。` : `Insufficient credits. ${provider} costs ${cost} credits.`);
      return false;
    }

    // 扣除点数并记录日志
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ credits_used: profile.credits_used + cost })
      .eq('id', session.user.id);
    
    if (updateError) throw updateError;

    // 记录使用日志
    await supabase.from('usage_logs').insert([{
      user_id: session.user.id,
      model: provider,
      action: 'ai_process',
      credits_spent: cost
    }]);
      
    return true;
  };

  const handleOptimize = async () => {
    if (!(await checkAndConsumeCredit(aiProvider))) return;

    setIsOptimizing(true);
    try {
      let opt;
      if (aiProvider === 'openai') {
        opt = await optimizeListingWithOpenAI(localListing.cleaned!);
      } else if (aiProvider === 'deepseek') {
        opt = await optimizeListingWithDeepSeek(localListing.cleaned!);
      } else {
        opt = await optimizeListingWithAI(localListing.cleaned!);
      }
      const updated = { ...localListing, status: 'optimized' as const, optimized: opt };
      setLocalListing(updated);
      await syncToSupabase(updated);
    } catch (e: any) { alert("Optimization failed: " + e.message); } 
    finally { setIsOptimizing(false); }
  };

  const syncToSupabase = async (targetListing: Listing) => {
    if (!isSupabaseConfigured()) return;
    setIsSaving(true);
    try {
      const payload = {
        cleaned: targetListing.cleaned,
        optimized: targetListing.optimized || null,
        translations: targetListing.translations || null,
        status: targetListing.status,
        sourcing_data: targetListing.sourcing_data || [],
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('listings').update(payload).eq('id', targetListing.id);
      if (error) throw error;
      onUpdate({ ...targetListing, updated_at: new Date().toISOString() });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e: any) { 
      console.error("Save failed:", e);
    } finally { 
      setIsSaving(false); 
    }
  };

  // 渲染其余 UI (保持原样，仅展示计费逻辑更改)
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900 font-inter animate-in fade-in duration-500 pb-20 relative">
      {/* 渲染内容 */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-4 z-40">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-black text-sm uppercase tracking-widest">
            <ArrowLeft size={18} className="mr-2" /> {t('back')}
          </button> 
          {lastSaved && <div className="flex items-center gap-1.5 text-[10px] font-black text-green-500 uppercase bg-green-50 px-3 py-1 rounded-full border border-green-100"><Check size={12} /> Auto-saved @ {lastSaved}</div>}
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setAiProvider('gemini')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${aiProvider === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Gemini (3)</button>
            <button onClick={() => setAiProvider('openai')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${aiProvider === 'openai' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>GPT-4o (2)</button>
            <button onClick={() => setAiProvider('deepseek')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${aiProvider === 'deepseek' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}>DeepSeek (1)</button>
          </div>
          <button onClick={handleOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all uppercase">{isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} AI Optimize</button>
          <button onClick={() => syncToSupabase(localListing)} disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all uppercase">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {t('save')}</button>
        </div>
      </div>
      {/* 其他 ListingDetail 组件内容... */}
    </div>
  );
};
