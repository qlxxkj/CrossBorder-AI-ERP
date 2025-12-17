import React from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { UILanguage } from '../types';
import { UI_LANGUAGES } from '../lib/i18n';

interface LanguageSwitcherProps {
  currentLang: UILanguage;
  onLanguageChange: (lang: UILanguage) => void;
  isDark?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ currentLang, onLanguageChange, isDark }) => {
  return (
    <div className="relative group">
      <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
        isDark 
          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' 
          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'
      }`}>
        <Globe size={16} />
        <span className="text-xs font-bold uppercase">
          {UI_LANGUAGES.find(l => l.code === currentLang)?.code}
        </span>
        <ChevronDown size={12} className="opacity-50" />
      </button>
      
      <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-100 shadow-2xl rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100]">
        {UI_LANGUAGES.map((lang) => (
          <button 
            key={lang.code}
            onClick={() => onLanguageChange(lang.code as UILanguage)}
            className={`w-full px-4 py-2 text-left text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-between ${currentLang === lang.code ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}
          >
            <span>{lang.name}</span>
            <span className="text-lg">{lang.flag}</span>
          </button>
        ))}
      </div>
    </div>
  );
};