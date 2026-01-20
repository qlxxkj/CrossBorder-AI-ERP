
import React, { useState, useRef, useEffect } from 'react';
import { Package, LogOut, LayoutDashboard, Settings, Layout, List, Tags, Coins, CreditCard, User, ChevronRight, Crown, Sparkles, Mail, ShieldCheck, RefreshCcw } from 'lucide-react';
import { UILanguage, UserProfile } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase } from '../lib/supabaseClient';

interface SidebarProps {
  onLogout: () => void;
  onLogoClick: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: UILanguage;
  userEmail?: string;
  userProfile?: UserProfile | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout, onLogoClick, activeTab, setActiveTab, lang, userEmail, userProfile }) => {
  const t = useTranslation(lang);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const userName = userEmail ? userEmail.split('@')[0] : 'User';
  // 关键：这里直接检查 userProfile 中的 role
  const isAdmin = userProfile?.role === 'admin';
  
  const menuItems = [
    { id: 'dashboard', label: lang === 'zh' ? '概览' : 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'listings', label: t('listings'), icon: <List size={20} /> },
    { id: 'categories', label: lang === 'zh' ? '分类管理' : 'Categories', icon: <Tags size={20} /> },
    { id: 'pricing', label: lang === 'zh' ? '定价中心' : 'Pricing Center', icon: <Coins size={20} /> },
    { id: 'templates', label: t('templates'), icon: <Layout size={20} /> },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 z-50 shadow-2xl">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <button onClick={onLogoClick} className="text-xl font-black flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="bg-blue-600 px-2 py-0.5 rounded text-sm text-white">ERP</span> <span className="text-white">AMZBot</span>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        <p className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Main Menu</p>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-105' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="font-bold text-sm">{item.label}</span>
          </button>
        ))}

        {isAdmin && (
          <div className="pt-6 mt-6 border-t border-slate-800 animate-in fade-in slide-in-from-left-4 duration-500">
            <p className="px-4 py-2 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Management</p>
            <button
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'admin' 
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50 scale-105' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-amber-400'
              }`}
            >
              <ShieldCheck size={20} />
              <span className="font-bold text-sm">{lang === 'zh' ? '运营管理后台' : 'Admin Console'}</span>
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 relative" ref={profileRef}>
        {isProfileOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-[60]">
            <div className="p-4 border-b border-slate-700 bg-slate-800/50 text-white">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black uppercase shadow-lg ${isAdmin ? 'bg-amber-500' : 'bg-blue-600'}`}>
                  {userName.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black truncate">{userName}</p>
                    {isAdmin && <span className="bg-amber-500/20 text-amber-500 text-[8px] px-1.5 py-0.5 rounded font-black border border-amber-500/30">ADMIN</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1"><Mail size={10} /> {userEmail}</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-b border-slate-700 space-y-3">
               <div className="flex items-center justify-between">
                 <span className="text-xs font-bold text-slate-300 flex items-center gap-2"><Crown size={14} className="text-amber-400" /> {userProfile?.plan_type || 'Free'}</span>
                 <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{userProfile ? (userProfile.credits_total - userProfile.credits_used) : 0} {t('credits')}</span>
               </div>
               <button 
                onClick={() => { setActiveTab('billing'); setIsProfileOpen(false); }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 text-white"
               >
                 <Sparkles size={14} /> {t('upgradePlan')}
               </button>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-700 transition-all font-bold text-xs"
            >
              <RefreshCcw size={16} />
              <span>{lang === 'zh' ? '重载系统权限' : 'Reload Access'}</span>
            </button>

            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-all font-bold text-xs"
            >
              <LogOut size={16} />
              <span>{t('signOut')}</span>
            </button>
          </div>
        )}

        <button 
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
            isProfileOpen ? 'bg-slate-800 ring-1 ring-slate-700 shadow-inner' : 'hover:bg-slate-800 border border-transparent hover:border-slate-700'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isAdmin ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-slate-800 border-slate-700 text-blue-400'}`}>
            {isAdmin ? <ShieldCheck size={20} /> : <User size={20} />}
          </div>
          <div className="flex-1 text-left overflow-hidden">
            <p className="text-xs font-black truncate text-slate-100 flex items-center gap-1.5">
              {userName}
              {isAdmin && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>}
            </p>
            <p className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-tighter">
              {isAdmin ? 'System Administrator' : `${userProfile?.plan_type || 'Free'} Member`}
            </p>
          </div>
          <ChevronRight size={14} className={`text-slate-600 transition-transform ${isProfileOpen ? 'rotate-90' : ''}`} />
        </button>
      </div>
    </div>
  );
};
