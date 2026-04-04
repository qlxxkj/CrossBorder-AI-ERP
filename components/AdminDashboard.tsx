
import React, { useState, useEffect } from 'react';
import { 
  Users, Package, Settings, Search, Filter, ShieldAlert, 
  MoreHorizontal, ChevronRight, Loader2, Save, Trash2, 
  Clock, CreditCard, Ban, CheckCircle, RefreshCcw, UserPlus, ShieldCheck, Check,
  Plus, Edit3, X, Coins, Sparkles
} from 'lucide-react';
import { UserProfile, SubscriptionPlan, UILanguage, BillingConfig, BillingUnitPrice } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AdminDashboardProps {
  uiLang: UILanguage;
  activeSubTab?: 'users' | 'plans' | 'billing_unit' | 'billing_consumption';
  onSubTabChange?: (tab: 'users' | 'plans' | 'billing_unit' | 'billing_consumption') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ uiLang, activeSubTab = 'users', onSubTabChange }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingConfigs, setBillingConfigs] = useState<BillingConfig[]>([]);
  const [billingUnitPrices, setBillingUnitPrices] = useState<BillingUnitPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  const [showUnitPriceModal, setShowUnitPriceModal] = useState(false);
  const [editingUnitPrice, setEditingUnitPrice] = useState<BillingUnitPrice | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BillingConfig | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      if (activeSubTab === 'users') {
        const { data } = await supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
        if (data) setUsers(data);
      } else if (activeSubTab === 'plans') {
        const { data } = await supabase.from('subscription_plans').select('*').order('price_usd', { ascending: true });
        if (data) setPlans(data);
      } else if (activeSubTab === 'billing_unit' || activeSubTab === 'billing_consumption') {
        await fetchBillingConfigs();
        await fetchBillingUnitPrices();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingConfigs = async () => {
    const { data } = await supabase.from('billing_configs').select('*').order('service_name', { ascending: true });
    if (!data || data.length === 0) {
      const defaults = [
        { service_name: 'openai', action_type: 'optimization', credit_cost: 5 },
        { service_name: 'openai', action_type: 'translation', credit_cost: 2 },
        { service_name: 'gemini', action_type: 'optimization', credit_cost: 3 },
        { service_name: 'gemini', action_type: 'translation', credit_cost: 1 },
        { service_name: 'deepseek', action_type: 'optimization', credit_cost: 2 },
        { service_name: 'deepseek', action_type: 'translation', credit_cost: 1 },
      ];
      const { data: inserted } = await supabase.from('billing_configs').insert(
        defaults.map(d => ({ ...d, updated_at: new Date().toISOString() }))
      ).select();
      if (inserted) setBillingConfigs(inserted);
    } else {
      setBillingConfigs(data);
    }
  };

  const fetchBillingUnitPrices = async () => {
    const { data } = await supabase.from('billing_unit_prices').select('*').order('unit_type', { ascending: true });
    if (!data || data.length === 0) {
      const defaults = [
        { name: '1 Credit = 1000 Tokens', unit_type: 'token_per_credit', value: 1000 },
        { name: '1 Optimization = 5 Credits', unit_type: 'credit_per_optimization', value: 5 },
        { name: '1 Translation = 2 Credits', unit_type: 'credit_per_translation', value: 2 },
      ];
      const { data: inserted } = await supabase.from('billing_unit_prices').insert(
        defaults.map(d => ({ ...d, updated_at: new Date().toISOString() }))
      ).select();
      if (inserted) setBillingUnitPrices(inserted);
    } else {
      setBillingUnitPrices(data);
    }
  };

  const handleSaveUnitPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnitPrice) return;
    setLoading(true);
    const data = { ...editingUnitPrice, updated_at: new Date().toISOString() };
    if (editingUnitPrice.id) {
      await supabase.from('billing_unit_prices').update(data).eq('id', editingUnitPrice.id);
    } else {
      const { id, ...rest } = data;
      await supabase.from('billing_unit_prices').insert([{ ...rest, id: crypto.randomUUID() }]);
    }
    await fetchBillingUnitPrices();
    setShowUnitPriceModal(false);
    setLoading(false);
  };

  const handleDeleteUnitPrice = async (id: string) => {
    if (!window.confirm(uiLang === 'zh' ? '确定删除吗？' : 'Are you sure?')) return;
    setLoading(true);
    await supabase.from('billing_unit_prices').delete().eq('id', id);
    await fetchBillingUnitPrices();
    setLoading(false);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setLoading(true);
    if (editingPlan.id) {
      const { id, ...rest } = editingPlan;
      const existing = plans.find(p => p.id === id);
      if (existing) {
        await supabase.from('subscription_plans').update(rest).eq('id', id);
      } else {
        await supabase.from('subscription_plans').insert([editingPlan]);
      }
    } else {
      // New plan needs an ID
      const newId = prompt(uiLang === 'zh' ? '请输入套餐ID (例如: Pro, Elite)' : 'Enter Plan ID (e.g. Pro, Elite)', 'NewPlan');
      if (newId) {
        await supabase.from('subscription_plans').insert([{ ...editingPlan, id: newId }]);
      }
    }
    const { data } = await supabase.from('subscription_plans').select('*').order('price_usd', { ascending: true });
    if (data) setPlans(data);
    setShowPlanModal(false);
    setLoading(false);
  };

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm(uiLang === 'zh' ? '确定删除吗？' : 'Are you sure?')) return;
    setLoading(true);
    await supabase.from('subscription_plans').delete().eq('id', id);
    const { data } = await supabase.from('subscription_plans').select('*').order('price_usd', { ascending: true });
    if (data) setPlans(data);
    setLoading(false);
  };

  const handleSaveBillingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;
    setLoading(true);
    const data = { ...editingConfig, updated_at: new Date().toISOString() };
    if (editingConfig.id) {
      await supabase.from('billing_configs').update(data).eq('id', editingConfig.id);
    } else {
      const { id, ...rest } = data;
      await supabase.from('billing_configs').insert([{ ...rest, id: crypto.randomUUID() }]);
    }
    await fetchBillingConfigs();
    setShowConfigModal(false);
    setLoading(false);
  };

  const handleDeleteBillingConfig = async (id: string) => {
    if (!window.confirm(uiLang === 'zh' ? '确定删除吗？' : 'Are you sure?')) return;
    setLoading(true);
    await supabase.from('billing_configs').delete().eq('id', id);
    await fetchBillingConfigs();
    setLoading(false);
  };

  const handleUpdateBillingConfig = async (id: string, cost: number) => {
    const { error } = await supabase
      .from('billing_configs')
      .update({ credit_cost: cost, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setBillingConfigs(prev => prev.map(c => c.id === id ? { ...c, credit_cost: cost } : c));
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
            onClick={() => onSubTabChange?.('users')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeSubTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={16} /> Users
          </button>
          <button 
            onClick={() => onSubTabChange?.('plans')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeSubTab === 'plans' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Package size={16} /> Plans
          </button>
          <button 
            onClick={() => onSubTabChange?.('billing_unit')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeSubTab === 'billing_unit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <CreditCard size={16} /> {uiLang === 'zh' ? '计费单价' : 'Unit Price'}
          </button>
          <button 
            onClick={() => onSubTabChange?.('billing_consumption')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${activeSubTab === 'billing_consumption' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Coins size={16} /> {uiLang === 'zh' ? '计费消耗' : 'Consumption'}
          </button>
        </div>
      </div>

      {activeSubTab === 'users' ? (
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
      ) : activeSubTab === 'plans' ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => { setEditingPlan({ id: '', name: '', name_zh: '', price_usd: 0, price_cny: 0, credits: 0, features: [], features_zh: [] }); setShowPlanModal(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl"
            >
              <Plus size={14}/> {uiLang === 'zh' ? '新增套餐' : 'Add Plan'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             {plans.map(plan => (
               <div key={plan.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8 flex flex-col group relative">
                  <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingPlan(plan); setShowPlanModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"><Edit3 size={16}/></button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg"><Trash2 size={16}/></button>
                  </div>
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
               </div>
             ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-10 space-y-10 animate-in slide-in-from-bottom-4 duration-500 relative overflow-hidden min-h-[500px]">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
               <Loader2 size={40} className="animate-spin text-indigo-600" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
              <Coins className="text-amber-500" size={18} /> 
              {activeSubTab === 'billing_unit' ? (uiLang === 'zh' ? '计费单价' : 'Unit Price') : (uiLang === 'zh' ? '计费消耗' : 'Consumption')}
            </h3>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] space-y-3">
            <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={14} /> Billing Logic Note
            </h4>
            <p className="text-xs text-amber-700 font-bold leading-relaxed">
              {uiLang === 'zh' 
                ? '计费逻辑说明：每个用户账户每月自动赠送 100 个免费积分，月底清零不累计。管理员在此配置的计费单价和消耗标准将立即生效。如果未配置特定引擎的消耗，将回退到通用单价配置。' 
                : 'Billing Logic: Each user account receives 100 free credits monthly, which reset at the end of the month and do not accumulate. Changes made here take effect immediately. If no specific engine consumption is configured, the system will fall back to general unit price settings.'}
            </p>
          </div>

          {activeSubTab === 'billing_unit' ? (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => { setEditingUnitPrice({ id: '', name: '', unit_type: 'token_per_credit', value: 0, updated_at: '' }); setShowUnitPriceModal(true); }}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl"
                >
                  <Plus size={14}/> {uiLang === 'zh' ? '新增单价' : 'Add Unit Price'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {billingUnitPrices.filter(p => p.unit_type === 'token_per_credit').map(price => (
                  <div key={price.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 group hover:border-indigo-500 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><CreditCard size={20}/></div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setEditingUnitPrice(price); setShowUnitPriceModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={16}/></button>
                        <button onClick={() => handleDeleteUnitPrice(price.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <h4 className="font-black text-slate-800 text-sm">{price.name}</h4>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900">{price.value}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Tokens/Credit
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-end">
                <button 
                  onClick={() => { setEditingConfig({ id: '', service_name: 'openai', action_type: 'optimization', credit_cost: 0, updated_at: '' }); setShowConfigModal(true); }}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl"
                >
                  <Plus size={14}/> {uiLang === 'zh' ? '新增消耗配置' : 'Add Consumption Config'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {['openai', 'gemini', 'deepseek'].map(service => (
                  <div key={service} className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                        <Sparkles size={20} className={service === 'openai' ? 'text-green-500' : service === 'gemini' ? 'text-blue-500' : 'text-indigo-500'} />
                      </div>
                      <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{service}</h4>
                    </div>

                    <div className="space-y-4">
                      {billingConfigs.filter(c => c.service_name === service).map(config => (
                        <div key={config.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 group relative">
                          <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditingConfig(config); setShowConfigModal(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"><Edit3 size={14}/></button>
                            <button onClick={() => handleDeleteBillingConfig(config.id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg"><Trash2 size={14}/></button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {config.action_type === 'optimization' ? (uiLang === 'zh' ? '优化' : 'Optimization') : (uiLang === 'zh' ? '翻译' : 'Translation')}
                            </span>
                            <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-tighter">Per Action</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input 
                              type="number" 
                              value={config.credit_cost} 
                              onChange={e => handleUpdateBillingConfig(config.id, parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-black text-base text-slate-900 outline-none focus:border-indigo-500 transition-all"
                            />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Credits</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 计费单价编辑弹窗 */}
      {showUnitPriceModal && editingUnitPrice && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="font-black text-slate-900 uppercase tracking-tight">{uiLang === 'zh' ? '计费单价配置' : 'Unit Price Config'}</h3>
                 <button onClick={() => setShowUnitPriceModal(false)}><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveUnitPrice} className="p-8 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uiLang === 'zh' ? '配置名称' : 'Config Name'}</label>
                    <input 
                      required 
                      value={editingUnitPrice.name}
                      onChange={e => setEditingUnitPrice({...editingUnitPrice, name: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" 
                      placeholder="e.g. 1 Credit = 1000 Tokens" 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uiLang === 'zh' ? '计费类型' : 'Unit Type'}</label>
                    <select 
                      value={editingUnitPrice.unit_type} 
                      onChange={e => setEditingUnitPrice({...editingUnitPrice, unit_type: e.target.value as any})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase"
                    >
                      <option value="token_per_credit">Token per Credit</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uiLang === 'zh' ? '数值' : 'Value'}</label>
                    <input 
                      type="number"
                      required 
                      value={editingUnitPrice.value}
                      onChange={e => setEditingUnitPrice({...editingUnitPrice, value: parseFloat(e.target.value) || 0})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" 
                    />
                 </div>
                 <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{uiLang === 'zh' ? '保存' : 'Save'}</button>
              </form>
           </div>
        </div>
      )}
      {/* 计费套餐编辑弹窗 */}
      {showPlanModal && editingPlan && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="font-black text-slate-900 uppercase tracking-tight">{uiLang === 'zh' ? '套餐配置' : 'Plan Config'}</h3>
                 <button onClick={() => setShowPlanModal(false)}><X size={24}/></button>
              </div>
              <form onSubmit={handleSavePlan} className="p-8 grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name (EN)</label>
                    <input required value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name (ZH)</label>
                    <input required value={editingPlan.name_zh} onChange={e => setEditingPlan({...editingPlan, name_zh: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price (USD)</label>
                    <input type="number" required value={editingPlan.price_usd} onChange={e => setEditingPlan({...editingPlan, price_usd: parseFloat(e.target.value) || 0})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price (CNY)</label>
                    <input type="number" required value={editingPlan.price_cny} onChange={e => setEditingPlan({...editingPlan, price_cny: parseFloat(e.target.value) || 0})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credits</label>
                    <input type="number" required value={editingPlan.credits} onChange={e => setEditingPlan({...editingPlan, credits: parseInt(e.target.value) || 0})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                 </div>
                 <div className="col-span-2 flex justify-end gap-4 mt-4">
                    <button type="button" onClick={() => setShowPlanModal(false)} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                    <button type="submit" className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{uiLang === 'zh' ? '保存' : 'Save'}</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* 消耗配置编辑弹窗 */}
      {showConfigModal && editingConfig && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="font-black text-slate-900 uppercase tracking-tight">{uiLang === 'zh' ? '消耗配置' : 'Consumption Config'}</h3>
                 <button onClick={() => setShowConfigModal(false)}><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveBillingConfig} className="p-8 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Engine</label>
                    <select 
                      value={editingConfig.service_name} 
                      onChange={e => setEditingConfig({...editingConfig, service_name: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="gemini">Gemini</option>
                      <option value="deepseek">DeepSeek</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Action Type</label>
                    <select 
                      value={editingConfig.action_type} 
                      onChange={e => setEditingConfig({...editingConfig, action_type: e.target.value as any})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase"
                    >
                      <option value="optimization">Optimization</option>
                      <option value="translation">Translation</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credit Cost</label>
                    <input 
                      type="number"
                      required 
                      value={editingConfig.credit_cost}
                      onChange={e => setEditingConfig({...editingConfig, credit_cost: parseInt(e.target.value) || 0})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" 
                    />
                 </div>
                 <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">{uiLang === 'zh' ? '保存' : 'Save'}</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
