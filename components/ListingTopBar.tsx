
import React from 'react';
import { ArrowLeft, Sparkles, Loader2, Save, ChevronRight, Zap, Brain, Cpu, Trash2 } from 'lucide-react';
import { UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';

interface ListingTopBarProps {
  onBack: () => void;
  engine: 'gemini' | 'openai' | 'deepseek';
  setEngine: (e: any) => void;
  onOptimize: () => void;
  isOptimizing: boolean;
  onSave: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting?: boolean;
  onNext: () => void;
  uiLang: UILanguage;
}

export const ListingTopBar: React.FC<ListingTopBarProps> = ({
  onBack, engine, setEngine, onOptimize, isOptimizing, onSave, onDelete, isSaving, isDeleting, onNext, uiLang
}) => {
  const t = useTranslation(uiLang);
  return (
    <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm z-50">
      <div className="flex items-center gap-6">
        <button onClick={onBack} className="group flex items-center text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-all">
          <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> {t('back')}
        </button> 
        <div className="h-6 w-px bg-slate-200"></div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
           {(['gemini', 'openai', 'deepseek'] as const).map(e => (
             <button key={e} onClick={() => setEngine(e)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${engine === e ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
               {e === 'gemini' ? <Zap size={12}/> : e === 'openai' ? <Brain size={12}/> : <Cpu size={12}/>} {e}
             </button>
           ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onOptimize} disabled={isOptimizing} className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all uppercase shadow-sm disabled:opacity-50">
          {isOptimizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} AI Optimize Master
        </button>
        <div className="flex items-center bg-slate-900 rounded-2xl p-0.5 shadow-xl">
           <button onClick={onSave} disabled={isSaving || isDeleting} className="flex items-center gap-2 px-8 py-2.5 rounded-2xl font-black text-xs text-white hover:bg-black transition-all uppercase tracking-widest">
             {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('save')}
           </button>
           <div className="w-px h-6 bg-white/10 mx-1"></div>
           <button onClick={onDelete} disabled={isDeleting} className="p-2.5 text-slate-400 hover:text-red-400 rounded-2xl transition-all" title="Delete Listing">
              {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
           </button>
           <div className="w-px h-6 bg-white/10 mx-1"></div>
           <button onClick={onNext} className="p-2.5 text-white hover:bg-white/10 rounded-2xl transition-all" title="Next Listing">
              <ChevronRight size={18} />
           </button>
        </div>
      </div>
    </header>
  );
};
