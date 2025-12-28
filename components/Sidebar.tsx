
import React from 'react';
import { Package, LogOut, LayoutDashboard, Database, Settings, Layout, List } from 'lucide-react';
import { UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';

interface SidebarProps {
  onLogout: () => void;
  onLogoClick: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: UILanguage;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout, onLogoClick, activeTab, setActiveTab, lang }) => {
  const t = useTranslation(lang);
  const menuItems = [
    { id: 'dashboard', label: lang === 'zh' ? '概览' : 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'listings', label: t('listings'), icon: <List size={20} /> },
    { id: 'templates', label: t('templates'), icon: <Layout size={20} /> },
    { id: 'settings', label: t('settings'), icon: <Settings size={20} /> },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <button onClick={onLogoClick} className="text-xl font-black flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="bg-blue-600 px-2 py-0.5 rounded text-sm">ERP</span> AMZBot
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-2">
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

      <div className="p-6 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>{t('signOut')}</span>
        </button>
      </div>
    </div>
  );
};
