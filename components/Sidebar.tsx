import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, List, Tags, Coins, Layout, ShieldCheck, 
  Settings, LogOut, ChevronRight, Crown, Zap, 
  User, CreditCard, ArrowUpRight, ChevronUp, Mail, UserCircle
} from 'lucide-react';
import { UILanguage, UserProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: UILanguage;
  userProfile: UserProfile;
  session: any;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, lang, userProfile, session, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isSuper = userProfile.role === 'super_admin' || userProfile.role === 'admin';
  const isTenantAdmin = userProfile.role === 'tenant_admin';

  const userEmail = session?.user?.email || 'User';
  const emailPrefix = userEmail.split('@')[0];
  const creditsLeft = (userProfile.credits_total || 0) - (userProfile.credits_used || 0);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: lang === 'zh' ? '仪表盘' : 'Dashboard' },
    { id: 'listings', icon: <List size={18} />, label: lang === 'zh' ? '产品管理' : 'Listings' },
    { id: 'categories', icon: <Tags size={18} />, label: lang === 'zh' ? '类目管理' : 'Categories' },
    { id: 'pricing', icon: <Coins size={18} />, label: lang === 'zh' ? '定价中心' : 'Pricing' },
    { id: 'templates', icon: <Layout size={18} />, label: lang === 'zh' ? '模板管理' : 'Templates' },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col p-4 shadow-2xl z-50">
      <div className="p-4 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg shadow-blue-900/40">A</div>
        <span className="font-black text-xl tracking-tight uppercase">AMZBot</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
        <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Core Modules</p>
        {navItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
              activeTab === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {item.icon} <span className="text-sm font-bold">{item.label}</span>
          </button>
        ))}

        {isTenantAdmin && (
          <>
            <p className="px-4 pt-8 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Administration</p>
            <button 
              onClick={() => setActiveTab('system')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                activeTab === 'system' 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Settings size={18} /> <span className="text-sm font-bold">{lang === 'zh' ? '系统配置' : 'System'}</span>
            </button>
          </>
        )}

        {isSuper && (
          <>
            <p className="px-4 pt-8 text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">Global Ops</p>
            <button 
              onClick={() => setActiveTab('admin')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                activeTab === 'admin' 
                  ? 'bg-amber-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldCheck size={18} /> <span className="text-sm font-bold">{lang === 'zh' ? '管理后台' : 'Admin'}</span>
            </button>
          </>
        )}
      </nav>

      {/* User Center Interaction Area */}
      <div className="mt-auto relative pt-4 border-t border-slate-800" ref={menuRef}>
        {/* Modal Popover Menu */}
        {showUserMenu && (
          <div className="absolute bottom-full left-0 w-full mb-4 bg-slate-800 rounded-[2rem] border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 backdrop-blur-xl">
            <div className="p-6 border-b border-slate-700 bg-slate-900/40">
               <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg">
                     {emailPrefix.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                     <p className="text-sm font-black text-white truncate">{emailPrefix}</p>
                     <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                       <Mail size={10} /> {userEmail}
                     </p>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'zh' ? '订阅计划' : 'Plan'}</span>
                    <span className="text-[10px] font-black text-amber-400 flex items-center gap-1 uppercase">
                      <Crown size={12}/> {userProfile.plan_type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'zh' ? '剩余点数' : 'Credits'}</span>
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                      <Zap size={12}/> {creditsLeft}
                    </span>
                  </div>
               </div>
            </div>
            
            <div className="p-2 space-y-1">
               <button 
                onClick={() => { setActiveTab('billing'); setShowUserMenu(false); }}
                className="w-full flex items-center justify-between p-4 text-[10px] font-black uppercase text-slate-300 hover:bg-slate-700 hover:text-white rounded-2xl transition-all group"
               >
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20"><CreditCard size={14} className="text-indigo-400"/></div>
                   {lang === 'zh' ? '升级方案' : 'Upgrade Plan'}
                 </div>
                 <ArrowUpRight size={14} className="text-slate-500 group-hover:text-white" />
               </button>
               
               <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 p-4 text-[10px] font-black uppercase text-red-400 hover:bg-red-500/10 rounded-2xl transition-all group"
               >
                 <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20"><LogOut size={14}/></div>
                 {lang === 'zh' ? '退出登录' : 'Sign Out'}
               </button>
            </div>
          </div>
        )}

        {/* User Pill Display */}
        <button 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={`w-full p-2.5 rounded-2xl border transition-all flex items-center gap-3 text-left ${
            showUserMenu ? 'bg-slate-800 border-slate-700 shadow-inner' : 'bg-transparent border-transparent hover:bg-slate-800'
          }`}
        >
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0 font-black">
             {emailPrefix.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-black truncate text-white">{emailPrefix}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                 {userProfile.plan_type}
               </span>
               <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-0.5">
                 <Zap size={8} className="text-amber-500" /> {creditsLeft}
               </span>
            </div>
          </div>
          <ChevronRight size={16} className={`text-slate-500 transition-transform duration-300 ${showUserMenu ? 'rotate-90' : ''}`} />
        </button>
      </div>
    </div>
  );
};