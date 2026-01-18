
import React, { useState, useRef, useEffect } from 'react';
import { Package, LogOut, LayoutDashboard, Settings, Layout, List, Tags, Coins, CreditCard, User, ChevronRight, Crown, Sparkles, Mail } from 'lucide-react';
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
  
  // 原有的主菜单项（移除 billing）
  const menuItems = [
    { id: 'dashboard', label: lang === 'zh' ? '概览' : 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'listings', label: t('listings'), icon: <List size={20} /> },
    { id: 'categories', label: lang === 'zh' ? '分类管理' : 'Categories', icon: <Tags size={20} /> },
    { id: 'pricing', label: lang === 'zh' ? '定价中心' : 'Pricing Center', icon: <Coins size={20} /> },
    { id: 'templates', label: t('templates'), icon: <Layout size={20} /> },
    { id: 'settings', label: t('settings'), icon: <Settings size={20} /> },
  ];

  // 监听点击外部关闭个人菜单
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
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <button onClick={onLogoClick} className="text-xl font-black flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="bg-blue-600 px-2 py-0.5 rounded text-sm">ERP</span> AMZBot
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
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
      </nav>

      {/* 用户资料面板区域 */}
      <div className="p-4 border-t border-slate-800 relative" ref={profileRef}>
        {/* 弹出菜单 */}
        {isProfileOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-[60]">
            {/* 个人信息头部 */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t('personalInfo')}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black uppercase">
                  {userName.charAt(0)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-black truncate">{userName}</p>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1"><Mail size={10} /> {userEmail}</p>
                </div>
              </div>
            </div>

            {/* 套餐状态 */}
            <div className="p-4 border-b border-slate-700">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-xs font-bold text-slate-300 flex items-center gap-2"><Crown size={14} className="text-amber-400" /> {userProfile?.plan_type || 'Free'}</span>
                 <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{userProfile ? (userProfile.credits_total - userProfile.credits_used) : 0} {t('credits')}</span>
               </div>
               <button 
                onClick={() => { setActiveTab('billing'); setIsProfileOpen(false); }}
                className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
               >
                 <Sparkles size={14} /> {t('upgradePlan')}
               </button>
            </div>

            {/* 退出按钮 */}
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-all font-bold text-xs"
            >
              <LogOut size={16} />
              <span>{t('signOut')}</span>
            </button>
          </div>
        )}

        {/* 底部悬浮触发器 */}
        <button 
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
            isProfileOpen ? 'bg-slate-800 ring-1 ring-slate-700 shadow-inner' : 'hover:bg-slate-800'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
            <User size={20} />
          </div>
          <div className="flex-1 text-left overflow-hidden">
            <p className="text-xs font-black truncate text-slate-100">{userName}</p>
            <p className="text-[10px] font-bold text-slate-500 truncate flex items-center gap-1">
              <span className="text-amber-500 uppercase">{userProfile?.plan_type || 'Free'}</span>
              <span className="opacity-30">|</span>
              <span>{userProfile ? (userProfile.credits_total - userProfile.credits_used) : 0} Credits</span>
            </p>
          </div>
          <ChevronRight size={14} className={`text-slate-600 transition-transform ${isProfileOpen ? 'rotate-90' : ''}`} />
        </button>
      </div>
    </div>
  );
};
