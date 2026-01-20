
import React, { useState, useEffect } from 'react';
import { CheckCircle, TrendingUp, Package, Sparkles, Globe, Clock, Zap, RefreshCcw, Loader2, Layout, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import { Listing, UILanguage, UserProfile } from '../types';
import { useTranslation } from '../lib/i18n';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface DashboardProps {
  listings: Listing[];
  lang: UILanguage;
  isSyncing?: boolean;
  onRefresh?: () => void;
  userProfile?: UserProfile | null;
  onNavigate?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ listings, lang, isSyncing, onRefresh, userProfile, onNavigate }) => {
  const t = useTranslation(lang);
  const [templateCount, setTemplateCount] = useState(0);
  // Corrected role check to match super_admin
  const isAdmin = userProfile?.role === 'super_admin' || userProfile?.role === 'admin';

  useEffect(() => {
    const fetchTemplateCount = async () => {
      if (!isSupabaseConfigured()) return;
      const { count } = await supabase.from('templates').select('*', { count: 'exact', head: true });
      setTemplateCount(count || 0);
    };
    fetchTemplateCount();
  }, []);

  const stats = {
    total: listings.length,
    optimized: listings.filter(l => l.status === 'optimized').length,
    pending: listings.filter(l => l.status !== 'optimized').length,
    translated: listings.reduce((acc, curr) => acc + (curr.translations ? Object.keys(curr.translations).length : 0), 0)
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* 管理员权限显著提醒 */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 rounded-[2.5rem] shadow-2xl shadow-amber-200 text-white flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                 <ShieldCheck size={32} />
              </div>
              <div>
                 <h3 className="text-xl font-black tracking-tight">{lang === 'zh' ? '检测到管理员权限' : 'Administrator Privileges Detected'}</h3>
                 <p className="text-amber-100 text-sm font-bold opacity-90">{lang === 'zh' ? '您可以管理全站用户数据、订阅套餐和系统配置。' : 'You can manage all users, subscription plans, and system configs.'}</p>
              </div>
           </div>
           <button 
             onClick={() => onNavigate?.('admin')}
             className="px-8 py-3 bg-white text-orange-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-50 transition-all shadow-xl flex items-center gap-2 group"
           >
             {lang === 'zh' ? '立即进入管理后台' : 'Enter Admin Console'}
             <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
           </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {lang === 'zh' ? '数据概览' : 'Overview'}
          </h2>
          <p className="text-slate-400 font-medium text-sm">Monitor your cross-border business performance.</p>
        </div>
        
        <div className="flex items-center gap-4">
          {onRefresh && (
            <button 
              onClick={onRefresh} 
              disabled={isSyncing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm active:scale-95'
              }`}
            >
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              {isSyncing ? 'Syncing...' : 'Refresh Data'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('totalListings')} value={stats.total} icon={<Package className="text-blue-500" />} />
        <StatCard title={t('optimized')} value={stats.optimized} icon={<Sparkles className="text-indigo-500" />} color="indigo" />
        
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
          <div className="flex justify-between items-start">
            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{lang === 'zh' ? '当前剩余点数' : 'Credits Balance'}</h3>
            <div className="p-2 rounded-xl bg-amber-50 group-hover:scale-110 transition-transform"><Zap className="text-amber-500" size={18} /></div>
          </div>
          <p className="text-4xl font-black text-slate-900 mt-4 tracking-tighter">
            {(userProfile?.credits_total || 0) - (userProfile?.credits_used || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-between group hover:scale-[1.02] transition-transform">
          <h3 className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">{lang === 'zh' ? '已维护模板' : 'Active Templates'}</h3>
          <div className="flex items-end justify-between mt-4">
            <p className="text-4xl font-black">{templateCount}</p>
            <Layout className="text-white/20" size={32} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[500px] flex flex-col">
           <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                 <TrendingUp size={20} className="text-emerald-500" /> Recent Activity
              </h3>
              {isSyncing && <div className="text-[10px] font-black text-indigo-500 uppercase animate-pulse">Syncing...</div>}
           </div>
           
           <div className="space-y-6 flex-1">
              {isSyncing && listings.length === 0 ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse"></div>
                  ))}
                </div>
              ) : listings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 opacity-20 space-y-4">
                  <Package size={64} />
                  <p className="font-black uppercase tracking-widest text-xs">No active listings in database</p>
                </div>
              ) : (
                listings.slice(0, 5).map(l => (
                  <div key={l.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                     <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                        <img src={l.cleaned?.main_image} className="w-full h-full object-contain" />
                     </div>
                     <div className="flex-1">
                        <p className="text-xs font-black text-slate-800 line-clamp-1">{l.cleaned?.title}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{l.asin} &bull; {l.status}</p>
                     </div>
                     <div className="text-[10px] font-black text-slate-300 flex items-center gap-1">
                        <Clock size={12} /> {new Date(l.created_at).toLocaleDateString()}
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6">
           <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
              <h3 className="font-black uppercase text-xs tracking-widest text-slate-400">Account Summary</h3>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Current Plan</span>
                <span className="text-xs font-black text-indigo-400">{userProfile?.plan_type || 'Free'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Credit Usage</span>
                <span className="text-xs font-black">{userProfile?.credits_used || 0} / {userProfile?.credits_total || 0}</span>
              </div>
              <button 
                onClick={() => onNavigate?.('billing')}
                className="w-full py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all"
              >
                Top up / Upgrade
              </button>
           </div>
           
           <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest mt-2">Efficiency Tips</h3>
           <div className="space-y-4">
              <Tip icon={<Zap className="text-amber-500" />} text="Use AI Optimization for 30% higher conversion rates." />
              <Tip icon={<Globe className="text-blue-500" />} text="Expand to DE and FR markets for 2x reach." />
              <Tip icon={<CheckCircle className="text-green-500" />} text="Keep your EAN codes valid for Amazon entry." />
           </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color = "blue" }: any) => (
  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
    <div className="flex justify-between items-start">
      <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</h3>
      <div className={`p-2 rounded-xl bg-${color}-50 group-hover:scale-110 transition-transform`}>{icon}</div>
    </div>
    <p className="text-4xl font-black text-slate-900 mt-4 tracking-tighter">{value}</p>
  </div>
);

const Tip = ({ icon, text }: any) => (
  <div className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <div className="mt-0.5">{icon}</div>
    <p className="text-[11px] font-bold text-slate-600 leading-relaxed">{text}</p>
  </div>
);
