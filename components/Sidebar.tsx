
import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, List, Tags, Coins, Layout, ShieldCheck, 
  Settings, LogOut, ChevronRight, Crown, Zap, Package,
  CreditCard, ArrowUpRight, Mail, ChevronDown, Building, Users, Shield, FileText,
  ShoppingBag, Store
} from 'lucide-react';
import { UILanguage, UserProfile } from '../types';
import { useTranslation } from '../lib/i18n';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: UILanguage;
  userProfile: UserProfile;
  permissions?: any[];
  session: any;
  onLogout: () => void;
  onLogoClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, lang, userProfile, permissions = [], session, onLogout, onLogoClick }) => {
  const t = useTranslation(lang);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAmazonExpanded, setIsAmazonExpanded] = useState(true);
  const [isSystemExpanded, setIsSystemExpanded] = useState(activeTab.startsWith('system'));
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isSuper = userProfile.role === 'super_admin' || userProfile.role === 'admin';
  const isTenantAdmin = userProfile.role === 'tenant_admin';

  // 检查是否有系统管理权限
  const hasSystemAccess = isTenantAdmin || isSuper || permissions.some(p => p.menu_id?.startsWith('system:'));

  const userEmail = session?.user?.email || 'User';
  const emailPrefix = userEmail.split('@')[0];
  const creditsLeft = Number(((userProfile.credits_total || 0) - (userProfile.credits_used || 0)).toFixed(2));

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
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: t('dashboard') },
    { id: 'listings', icon: <List size={18} />, label: lang === 'zh' ? '产品列表' : t('listings') },
    { id: 'categories', icon: <Tags size={18} />, label: t('categoryMgmt') },
    { id: 'pricing', icon: <Coins size={18} />, label: t('pricing') },
    { id: 'templates', icon: <Layout size={18} />, label: t('templateManager') },
  ];

  const amazonSubItems = [
    { id: 'amazon:listings', icon: <Package size={16} />, label: lang === 'zh' ? '商品管理' : 'Listings' },
    { id: 'amazon:orders', icon: <ShoppingBag size={16} />, label: lang === 'zh' ? '订单管理' : 'Orders' },
  ];

  const systemSubItems = [
    { id: 'system:org', icon: <Building size={16} />, label: t('orgMgmt') },
    { id: 'system:roles', icon: <Shield size={16} />, label: t('roleMgmt') },
    { id: 'system:users', icon: <Users size={16} />, label: t('userMgmt') },
    { id: 'system:infringement_words', icon: <FileText size={16} />, label: t('infringementMgmt') },
    { id: 'sp_api', icon: <Zap size={16} />, label: lang === 'zh' ? 'SP-API 私有对接' : 'SP-API Private' },
  ];

  const adminSubItems = [
    { id: 'admin:users', label: 'Users', icon: <Users size={16} /> },
    { id: 'admin:organizations', label: lang === 'zh' ? '租户管理' : 'Organizations', icon: <Building size={16} /> },
    { id: 'admin:plans', label: 'Plans', icon: <Package size={16} /> },
    { id: 'admin:billing_mgmt', label: lang === 'zh' ? '计费管理' : 'Billing Mgmt', icon: <Coins size={16} /> },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col p-4 shadow-2xl z-50">
      <button onClick={onLogoClick} className="p-4 mb-6 flex items-center gap-3 hover:opacity-80 transition-opacity text-left">
        <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-lg font-black text-slate-950 shadow-lg shadow-amber-500/20">A</div>
        <div>
          <span className="font-black text-xl tracking-tight uppercase block leading-none">AMZBot</span>
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">CrossBorder ERP</span>
        </div>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
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

        {/* Amazon Dedicated Module */}
        <div className="space-y-1 pt-2">
          <button 
            onClick={() => setIsAmazonExpanded(!isAmazonExpanded)} 
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
              activeTab.startsWith('amazon')
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black' 
                : 'text-amber-400/90 hover:text-white hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Store size={18} className={activeTab.startsWith('amazon') ? 'text-slate-950' : 'text-amber-400'} /> 
              <span className="text-sm font-bold">{lang === 'zh' ? '亚马逊' : 'Amazon'}</span>
            </div>
            <ChevronDown size={14} className={`transition-transform duration-300 ${isAmazonExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          {isAmazonExpanded && (
            <div className="pl-4 space-y-1 mt-1 animate-in slide-in-from-top-2 duration-300">
              {amazonSubItems.map(sub => (
                <button 
                  key={sub.id}
                  onClick={() => setActiveTab(sub.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === sub.id ? 'bg-white/10 text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasSystemAccess && (
          <div className="space-y-1 pt-2">
            <button 
              onClick={() => setIsSystemExpanded(!isSystemExpanded)} 
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                activeTab.startsWith('system')
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} /> 
                <span className="text-sm font-bold">{t('systemMgmt')}</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-300 ${isSystemExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {isSystemExpanded && (
              <div className="pl-4 space-y-1 mt-1 animate-in slide-in-from-top-2 duration-300">
                {systemSubItems.filter(sub => isTenantAdmin || isSuper || permissions.some(p => p.menu_id === sub.id)).map(sub => (
                  <button 
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === sub.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {sub.icon} {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isSuper && (
          <div className="space-y-1 pt-2">
            <button 
              onClick={() => setActiveTab('admin')} 
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                activeTab === 'admin' || activeTab.startsWith('admin:')
                  ? 'bg-amber-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} /> <span className="text-sm font-bold">Admin Panel</span>
              </div>
              <ChevronRight size={14} className={`transition-transform duration-300 ${activeTab === 'admin' || activeTab.startsWith('admin:') ? 'rotate-90' : ''}`} />
            </button>
            
            {(activeTab === 'admin' || activeTab.startsWith('admin:')) && (
              <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 animate-in slide-in-from-top-2 duration-300">
                {adminSubItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === item.id 
                        ? 'text-amber-400 bg-amber-400/10' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="mt-auto relative pt-4 border-t border-slate-800" ref={menuRef}>
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
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</span>
                    <span className="text-[10px] font-black text-amber-400 flex items-center gap-1 uppercase">
                      <Crown size={12}/> {userProfile.plan_type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credits</span>
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                      <Zap size={12}/> {creditsLeft}
                    </span>
                  </div>
               </div>
            </div>
            
            <div className="p-2 space-y-1">
               <button 
                onClick={() => { setActiveTab('billing'); setShowUserMenu(false); }}
                className="w-full flex items-center justify-between p-3 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-xl text-xs font-black transition-all"
               >
                 <span className="flex items-center gap-2"><CreditCard size={14}/> Upgrade & Billing</span>
                 <ArrowUpRight size={14}/>
               </button>
               <button 
                onClick={onLogout}
                className="w-full flex items-center gap-2 p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl text-xs font-black transition-all"
               >
                 <LogOut size={14}/> {t('signOut')}
               </button>
            </div>
          </div>
        )}

        <button 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center justify-between p-2 rounded-2xl hover:bg-slate-800 transition-colors group text-left"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 group-hover:border-slate-500 transition-colors">
              {emailPrefix.slice(0, 1).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-black text-white truncate">{emailPrefix}</p>
              <p className="text-[10px] text-slate-500 truncate">{userProfile.plan_type} Tier</p>
            </div>
          </div>
          <ChevronRight size={14} className="text-slate-500 group-hover:text-white transition-colors shrink-0" />
        </button>
      </div>
    </div>
  );
};

