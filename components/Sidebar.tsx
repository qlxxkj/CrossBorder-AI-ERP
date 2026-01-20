
import React from 'react';
import { LayoutDashboard, List, Tags, Coins, Layout, ShieldCheck, Settings, Users, LogOut } from 'lucide-react';
import { UILanguage, UserProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: UILanguage;
  userProfile: UserProfile;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, lang, userProfile, onLogout }) => {
  const isSuper = userProfile.role === 'super_admin';
  const isTenantAdmin = userProfile.role === 'tenant_admin';

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col p-4">
      <div className="p-4 mb-8 font-black text-xl flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-sm">A</div>
        AMZBot
      </div>

      <nav className="flex-1 space-y-2">
        <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Main</p>
        <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'dashboard' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-800'}`}>
          <LayoutDashboard size={18} /> <span>概览</span>
        </button>
        <button onClick={() => setActiveTab('listings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'listings' ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-800'}`}>
          <List size={18} /> <span>产品</span>
        </button>

        {isTenantAdmin && (
          <>
            <p className="px-4 pt-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Management</p>
            <button onClick={() => setActiveTab('system')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'system' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <Settings size={18} /> <span>系统管理</span>
            </button>
          </>
        )}

        {isSuper && (
          <>
            <p className="px-4 pt-6 text-[10px] font-black text-amber-500 uppercase tracking-widest">Super Admin</p>
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${activeTab === 'admin' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <ShieldCheck size={18} /> <span>运营后台</span>
            </button>
          </>
        )}
      </nav>

      <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl">
        <LogOut size={18} /> <span>退出登录</span>
      </button>
    </div>
  );
};
