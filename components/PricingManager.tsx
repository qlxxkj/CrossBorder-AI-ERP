
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Tags, Coins, Save, Loader2, Info, Percent, Truck, Calculator, DollarSign, RefreshCw } from 'lucide-react';
import { PriceAdjustment, ExchangeRate, Category, UILanguage } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { AMAZON_MARKETPLACES } from '../lib/marketplaces';

interface PricingManagerProps {
  uiLang: UILanguage;
}

export const PricingManager: React.FC<PricingManagerProps> = ({ uiLang }) => {
  const [adjustments, setAdjustments] = useState<PriceAdjustment[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [newAdj, setNewAdj] = useState({ marketplace: 'ALL', category_id: 'ALL', percentage: 0, include_shipping: false });
  const [newRate, setNewRate] = useState({ marketplace: 'MX', rate: 1 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    const [adjRes, rateRes, catRes] = await Promise.all([
      supabase.from('price_adjustments').select('*').order('created_at', { ascending: false }),
      supabase.from('exchange_rates').select('*').order('marketplace', { ascending: true }),
      supabase.from('categories').select('*')
    ]);

    if (adjRes.data) setAdjustments(adjRes.data);
    if (rateRes.data) setExchangeRates(rateRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.from('price_adjustments').insert([{
        user_id: session.user.id,
        ...newAdj,
        created_at: new Date().toISOString()
      }]).select();

      if (error) throw error;
      if (data) setAdjustments([data[0], ...adjustments]);
      setNewAdj({ marketplace: 'ALL', category_id: 'ALL', percentage: 0, include_shipping: false });
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const existing = exchangeRates.find(r => r.marketplace === newRate.marketplace);
      if (existing) {
        const { error } = await supabase.from('exchange_rates').update({ rate: newRate.rate }).eq('id', existing.id);
        if (error) throw error;
        setExchangeRates(exchangeRates.map(r => r.id === existing.id ? { ...r, rate: newRate.rate } : r));
      } else {
        const { data, error } = await supabase.from('exchange_rates').insert([{
          user_id: session.user.id,
          marketplace: newRate.marketplace,
          rate: newRate.rate,
          created_at: new Date().toISOString()
        }]).select();
        if (error) throw error;
        if (data) setExchangeRates([...exchangeRates, data[0]]);
      }
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const deleteAdjustment = async (id: string) => {
    if (!window.confirm("Delete rule?")) return;
    const { error } = await supabase.from('price_adjustments').delete().eq('id', id);
    if (!error) setAdjustments(adjustments.filter(a => a.id !== id));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl">
          <Coins size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {uiLang === 'zh' ? '定价中心' : 'Pricing Center'}
          </h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Global Price Management Engine</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Price Adjustments */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
              <Calculator className="text-indigo-600" size={20} />
              {uiLang === 'zh' ? '调价比例管理' : 'Adjustment Rules'}
            </h3>
          </div>

          <form onSubmit={handleAddAdjustment} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marketplace</label>
                <select 
                  value={newAdj.marketplace} 
                  onChange={e => setNewAdj({...newAdj, marketplace: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                >
                  <option value="ALL">ALL MARKETPLACES</option>
                  {AMAZON_MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.code}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                <select 
                  value={newAdj.category_id} 
                  onChange={e => setNewAdj({...newAdj, category_id: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                >
                  <option value="ALL">ALL CATEGORIES</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adjustment (%)</label>
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="number" 
                    value={newAdj.percentage} 
                    onChange={e => setNewAdj({...newAdj, percentage: parseFloat(e.target.value) || 0})}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none" 
                    placeholder="e.g. 67"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3.5 bg-indigo-50 rounded-2xl border border-indigo-100 cursor-pointer select-none" onClick={() => setNewAdj({...newAdj, include_shipping: !newAdj.include_shipping})}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${newAdj.include_shipping ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-indigo-200'}`}>
                  {newAdj.include_shipping && <Info size={12} className="text-white" />}
                </div>
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Include Shipping Cost</span>
              </div>
            </div>

            <button disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              {uiLang === 'zh' ? '新增调价规则' : 'Add Rule'}
            </button>
          </form>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {adjustments.map(adj => (
              <div key={adj.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    {adj.marketplace === 'ALL' ? <Globe size={18} /> : <span className="text-xs font-black">{adj.marketplace}</span>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="font-black text-slate-900 text-lg">+{adj.percentage}%</span>
                       {adj.include_shipping && <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">+ Shipping</span>}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Cat: {adj.category_id === 'ALL' ? 'Global' : (categories.find(c => c.id === adj.category_id)?.name || 'Unknown')}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteAdjustment(adj.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
              </div>
            ))}
            {adjustments.length === 0 && (
              <div className="p-12 text-center bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-black uppercase text-xs tracking-widest">No active rules</div>
            )}
          </div>
        </section>

        {/* Exchange Rates */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
              <RefreshCw className="text-emerald-600" size={20} />
              {uiLang === 'zh' ? '站点汇率管理' : 'Exchange Rates'}
            </h3>
            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">Base: 1 USD</span>
          </div>

          <form onSubmit={handleUpdateRate} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marketplace</label>
                <select 
                  value={newRate.marketplace} 
                  onChange={e => setNewRate({...newRate, marketplace: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                >
                  {AMAZON_MARKETPLACES.map(m => <option key={m.code} value={m.code}>{m.flag} {m.code} ({m.currency})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rate (1 USD = ?)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="number" 
                    step="0.0001"
                    value={newRate.rate} 
                    onChange={e => setNewRate({...newRate, rate: parseFloat(e.target.value) || 0})}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none" 
                  />
                </div>
              </div>
            </div>

            <button disabled={isSubmitting} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {uiLang === 'zh' ? '更新汇率数据' : 'Update Rate'}
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {AMAZON_MARKETPLACES.map(m => {
              const rateEntry = exchangeRates.find(r => r.marketplace === m.code);
              return (
                <div key={m.code} className={`p-5 rounded-3xl border transition-all flex items-center gap-4 ${rateEntry ? 'bg-white border-slate-100' : 'bg-slate-50/50 border-dashed border-slate-100 opacity-40'}`}>
                  <div className="text-2xl">{m.flag}</div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">{m.code} / {m.currency}</p>
                    <p className="text-xl font-black text-slate-900">{rateEntry ? rateEntry.rate.toFixed(4) : '-'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="bg-slate-900 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full group-hover:scale-125 transition-transform duration-1000"></div>
         <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center text-indigo-400 border border-white/5 shadow-inner">
            <Calculator size={40} />
         </div>
         <div className="flex-1 space-y-2">
            <h4 className="text-xl font-black tracking-tight">{uiLang === 'zh' ? '多级调价逻辑说明' : 'Understanding Pricing Logic'}</h4>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              {uiLang === 'zh' 
                ? '最终价格将根据站点、分类自动叠加。例如：站点全局调价 30% × 某个分类特惠调价 10% × 实时汇率。如果任一规则勾选了“包含运费”，计算基数将包含 Listing 中的 Shipping 字段。'
                : 'Prices are calculated multi-dimensionally. Formula: Base Price × (Adjustment A) × (Adjustment B) × Exchange Rate. If any rule includes shipping, base = Price + Shipping.'}
            </p>
         </div>
      </div>
    </div>
  );
};
