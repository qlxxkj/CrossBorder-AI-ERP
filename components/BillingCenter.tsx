
import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Check, Zap, Crown, ShieldCheck, 
  Loader2, Wallet, Star, ShieldAlert, BadgeCheck
} from 'lucide-react';
import { UILanguage, UserProfile, SubscriptionPlan } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface BillingCenterProps {
  uiLang: UILanguage;
}

export const BillingCenter: React.FC<BillingCenterProps> = ({ uiLang }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const [profileRes, plansRes] = await Promise.all([
        session ? supabase.from('user_profiles').select('*').eq('id', session.user.id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('subscription_plans').select('*').order('price_usd', { ascending: true })
      ]);
      
      if (profileRes.data) setProfile(profileRes.data);
      if (plansRes.data) setPlans(plansRes.data);
    } catch (err) {
      console.error("Billing Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (plan: SubscriptionPlan, method: 'alipay' | 'paypal') => {
    if (plan.id === 'Free' || plan.id === profile?.plan_type) return;

    setProcessingId(plan.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(uiLang === 'zh' ? "请先登录" : "Please sign in.");

      const { data: order, error: orderError } = await supabase
        .from('payment_orders')
        .insert([{
          user_id: session.user.id,
          amount: uiLang === 'zh' ? (plan.price_cny || 0) : (plan.price_usd || 0),
          plan_id: plan.id,
          provider: method,
          currency: uiLang === 'zh' ? 'CNY' : 'USD',
          status: 'pending'
        }])
        .select().single();

      if (orderError) throw orderError;

      const { data, error: invokeError } = await supabase.functions.invoke('create-payment', {
        body: { 
          orderId: order.id, 
          amount: uiLang === 'zh' ? plan.price_cny : plan.price_usd, 
          planName: uiLang === 'zh' ? plan.name_zh : plan.name,
          method: method 
        }
      });

      if (invokeError) throw invokeError;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      alert(`Payment Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20 min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Plans...</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl">
            <CreditCard size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {uiLang === 'zh' ? '订阅中心' : 'Billing Center'}
            </h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Scale your cross-border business with AI</p>
          </div>
        </div>

        <div className="bg-white px-8 py-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-8">
           <div className="text-right">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uiLang === 'zh' ? '我的剩余点数' : 'Credits Remaining'}</p>
             <p className="text-3xl font-black text-indigo-600">{(profile?.credits_total || 0) - (profile?.credits_used || 0)}</p>
           </div>
           <div className="w-px h-12 bg-slate-100"></div>
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uiLang === 'zh' ? '当前方案' : 'Current Plan'}</p>
             <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest mt-1">
               <Crown size={12} className="text-amber-400" />
               {profile?.plan_type || 'Free'}
             </span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => {
          const isCurrent = (profile?.plan_type || 'Free') === plan.id;
          const currencySym = uiLang === 'zh' ? '¥' : '$';
          const price = uiLang === 'zh' ? (plan.price_cny || 0) : (plan.price_usd || 0);
          const features = uiLang === 'zh' ? (plan.features_zh || []) : (plan.features || []);
          const isProcessing = processingId === plan.id;

          return (
            <div 
              key={plan.id} 
              className={`bg-white rounded-[3rem] border-4 overflow-hidden flex flex-col group transition-all relative ${
                isCurrent 
                  ? 'border-indigo-600 shadow-2xl scale-105 z-10' 
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-6 right-6 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg z-20">
                  <BadgeCheck size={14} /> {uiLang === 'zh' ? '当前订阅中' : 'Active'}
                </div>
              )}

              <div className="p-10 space-y-8 flex-1">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900">{uiLang === 'zh' ? (plan.name_zh || plan.id) : (plan.name || plan.id)}</h3>
                    <div className="flex items-baseline gap-1 mt-6">
                      <span className="text-5xl font-black text-slate-900 tracking-tighter">{currencySym}{price}</span>
                      <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">/ mo</span>
                    </div>
                    <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-6 bg-indigo-50 w-fit px-3 py-1 rounded-lg">
                      {(plan.credits || 0).toLocaleString()} {uiLang === 'zh' ? 'AI 积分/月' : 'Credits/mo'}
                    </p>
                 </div>

                 <div className="space-y-4">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                        <span className="text-sm font-bold text-slate-600">{f}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100">
                 {isCurrent ? (
                   <button disabled className="w-full py-5 bg-slate-200 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-inner">
                     {uiLang === 'zh' ? '您当前的选择' : 'Current Selection'}
                   </button>
                 ) : plan.id === 'Free' ? (
                   <button disabled className="w-full py-5 bg-white border border-slate-200 text-slate-300 rounded-3xl font-black text-xs uppercase tracking-[0.2em]">
                     {uiLang === 'zh' ? '免费永久' : 'Free Tier'}
                   </button>
                 ) : (
                   <div className="space-y-3">
                      {uiLang === 'zh' ? (
                        <button 
                          onClick={() => handlePay(plan, 'alipay')}
                          disabled={!!processingId}
                          className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Wallet size={20} />}
                          支付宝支付升级
                        </button>
                      ) : (
                        <button 
                          onClick={() => handlePay(plan, 'paypal')}
                          disabled={!!processingId}
                          className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" className="h-5" />}
                          PayPal Checkout
                        </button>
                      )}
                   </div>
                 )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
