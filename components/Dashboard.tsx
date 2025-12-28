
import React from 'react';
// Added Zap to the import list from lucide-react
import { CheckCircle, TrendingUp, Package, Sparkles, Globe, Clock, Zap } from 'lucide-react';
import { Listing, UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';

interface DashboardProps {
  listings: Listing[];
  lang: UILanguage;
}

export const Dashboard: React.FC<DashboardProps> = ({ listings, lang }) => {
  const t = useTranslation(lang);

  const stats = {
    total: listings.length,
    optimized: listings.filter(l => l.status === 'optimized').length,
    pending: listings.filter(l => l.status !== 'optimized').length,
    translated: listings.reduce((acc, curr) => acc + (curr.translations ? Object.keys(curr.translations).length : 0), 0)
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          {lang === 'zh' ? '数据概览' : 'Overview'}
        </h2>
        <p className="text-slate-400 font-medium text-sm">Monitor your cross-border business performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('totalListings')} value={stats.total} icon={<Package className="text-blue-500" />} />
        <StatCard title={t('optimized')} value={stats.optimized} icon={<Sparkles className="text-indigo-500" />} color="indigo" />
        <StatCard title={lang === 'zh' ? '多语言版本' : 'Translations'} value={stats.translated} icon={<Globe className="text-purple-500" />} color="purple" />
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-xl text-white flex flex-col justify-between">
          <h3 className="text-blue-100 text-[10px] font-black uppercase tracking-widest">{t('extensionStatus')}</h3>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
            <p className="text-2xl font-black">{t('connected')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                 <TrendingUp size={20} className="text-emerald-500" /> Recent Activity
              </h3>
           </div>
           <div className="space-y-6">
              {listings.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                   <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                      <img src={l.cleaned.main_image} className="w-full h-full object-contain" />
                   </div>
                   <div className="flex-1">
                      <p className="text-xs font-black text-slate-800 line-clamp-1">{l.cleaned.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{l.asin} &bull; {l.status}</p>
                   </div>
                   <div className="text-[10px] font-black text-slate-300 flex items-center gap-1">
                      <Clock size={12} /> {new Date(l.created_at).toLocaleDateString()}
                   </div>
                </div>
              ))}
              {listings.length === 0 && (
                <div className="text-center py-10 opacity-20 font-black uppercase text-xs">No activity yet</div>
              )}
           </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
           <h3 className="font-black text-slate-900 mb-6 uppercase text-xs tracking-widest">Efficiency Tips</h3>
           <div className="space-y-4">
              {/* Fix: Ensured Zap icon is properly imported and used for efficiency tips */}
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
