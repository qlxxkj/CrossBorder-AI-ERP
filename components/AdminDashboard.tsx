
import React, { useState, useEffect } from 'react';
import { 
  Users, Package, Settings, Search, Filter, ShieldAlert, 
  MoreHorizontal, ChevronRight, Loader2, Save, Trash2, 
  Clock, CreditCard, Ban, CheckCircle, RefreshCcw, UserPlus, ShieldCheck, Check 
} from 'lucide-react';
import { UserProfile, SubscriptionPlan, UILanguage } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AdminDashboardProps {
  uiLang: UILanguage;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ uiLang }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'plans'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
        if (data) setUsers(data);
      } else {
        const { data } = await supabase.from('subscription_plans').select('*').order('price_usd', { ascending: true });
        if (data) setPlans(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspension = async (user: UserProfile) => {
    setIsUpdating(user.id);
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_suspended: !user.is_suspended })
      .eq('id', user.id);
    
    if (!error) {
      setUsers(users.map(u => u.id === user.id ? { ...u, is_suspended: !u.is_suspended } : u));
    }
    setIsUpdating(null);
  };

  const handleUpdateCredits = async (userId: string, newTotal: number) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ credits_total: newTotal })
      .eq('id', userId);
    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, credits_total: newTotal } : u));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-2xl">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Admin Console</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Operations & Control Hub</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={16} /> Users
          </button>
          <button 
            onClick={() => setActiveTab('plans')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'plans' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Package size={16} /> Plans
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
             <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
               <input 
                type="text" 
                placeholder="Search user ID or email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl focus:ring-4 focus:ring-indigo-500/5 outline-none font-bold"
               />
             </div>
             <button onClick={fetchData} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 transition-all">
               <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
             <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="p-8">User Info</th>
                    <th className="p-8">Subscription</th>
                    <th className="p-8">Credits Status</th>
                    <th className="p-8">Last Login</th>
                    <th className="p-8 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.filter(u => u.id.includes(searchTerm)).map(user => (
                    <tr key={user.id} className={`group hover:bg-slate-50/50 transition-all ${user.is_suspended ? 'opacity-50 grayscale' : ''}`}>
                      <td className="p-8">
                        <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${user.role === 'admin' || user.role === 'super_admin' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                             {user.id.slice(0, 2).toUpperCase()}
                           </div>
                           <div>
                              <p className="font-black text-slate-900 text-sm">{user.id.slice(0, 8)}...</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{user.role}</p>
                           </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase border border-indigo-100">
                          {user.plan_type}
                        </span>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-3">
                           <div>
                             <p className="text-xs font-black text-slate-900">{user.credits_total - user.credits_used} / {user.credits_total}</p>
                             <div className="w-24 h-1 bg-slate-100 rounded-full mt-1">
                               <div 
                                className="h-full bg-indigo-500 rounded-full" 
                                style={{ width: `${Math.min(100, (user.credits_used / user.credits_total) * 100)}%` }}
                               ></div>
                             </div>
                           </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                          <Clock size={14} className="text-slate-200" />
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                        </div>
                      </td>
                      <td className="p-8 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                           <button 
                            onClick={() => {
                              const extra = prompt("Add how many credits?", "500");
                              if (extra) handleUpdateCredits(user.id, user.credits_total + parseInt(extra));
                            }}
                            className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl"
                           >
                             <CreditCard size={18} />
                           </button>
                           <button 
                            onClick={() => handleToggleSuspension(user)}
                            className={`p-3 rounded-xl transition-all ${user.is_suspended ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                           >
                             {isUpdating === user.id ? <Loader2 className="animate-spin" size={18} /> : (user.is_suspended ? <CheckCircle size={18} /> : <Ban size={18} />)}
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {plans.map(plan => (
             <div key={plan.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8 flex flex-col">
                <div className="flex justify-between items-start">
                   <div>
                     <h4 className="text-2xl font-black text-slate-900">{uiLang === 'zh' ? (plan.name_zh || plan.id) : (plan.name || plan.id)}</h4>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{plan.id}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-3xl font-black text-slate-900">{uiLang === 'zh' ? `¥${plan.price_cny}` : `$${plan.price_usd}`}</p>
                   </div>
                </div>

                <div className="space-y-4 flex-1">
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Included Credits</p>
                      <p className="text-xl font-black text-indigo-600">{(plan.credits || 0).toLocaleString()}</p>
                   </div>
                   
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase ml-1">Plan Features</p>
                      {(uiLang === 'zh' ? (plan.features_zh || []) : (plan.features || [])).map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                          <Check size={12} className="text-indigo-400" /> {f}
                        </div>
                      ))}
                   </div>
                </div>

                <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                   <Settings size={16} /> Edit Config
                </button>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};
