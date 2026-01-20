
import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Check, Zap, Crown, ShieldCheck, 
  Loader2, Wallet, ExternalLink, ArrowRight, History, AlertCircle, Clock, 
  Terminal, ShieldAlert, WifiOff, FileSearch, Sparkles, Star
} from 'lucide-react';
import { UILanguage, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface BillingCenterProps {
  uiLang: UILanguage;
}

const PLANS = [
  {
    id: 'Free',
    name: 'Starter',
    name_zh: '初创版',
    price_usd: 0,
    price_cny: 0,
    credits: 30,
    features: ['10-30 AI Optimizations / mo', 'Basic Collect Tool', 'Community Support'],
    features_zh: ['每月 10-30 次 AI 优化', '基础采集工具', '社区支持'],
    color: 'slate'
  },
  {
    id: 'Pro',
    name: 'Growth',
    name_zh: '专业版',
    price_usd: 29,
    price_cny: 199,
    credits: 2000,
    features: ['Unlimited Product Collect', '2,000 AI Credits', 'Visual 1688 Search', 'Priority Support'],
    features_zh: ['无限量产品采集', '2,000 AI 点数', '以图搜搜 1688', '优先技术支持'],
    color: 'blue'
  },
  {
    id: 'Elite',
    name: 'Elite',
    name_zh: '旗舰版',
    price_usd: 79,
    price_cny: 549,
    credits: 10000,
    features: ['5 User Collaboration', '10,000 AI Credits', 'Custom Template Export', 'Full API Access'],
    features_zh: ['5 用户协作', '10,000 AI 点数', '自定义刊登模板导出', '全接口 API 访问'],
    color: 'indigo'
  }
];

export const BillingCenter: React.FC<BillingCenterProps> = ({ uiLang }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [connError, setConnError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST106' || profileError.message.includes('406')) {
          setConnError("DATABASE_MISSING");
        }
      } else if (profileData) {
        setProfile(profileData);
      }

      const { data: orderData } = await supabase
        .from('payment_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (orderData) setOrders(orderData);
      
    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (plan: typeof PLANS[0], method: 'alipay' | 'paypal') => {
    if (plan.id === 'Free' || plan.id === profile?.plan_type) return;

    setProcessingId(plan.id);
    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase configuration missing.");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(uiLang === 'zh' ? "请先登录后再充值" : "Please sign in first.");

      const { data: order, error: orderError } = await supabase
        .from('payment_orders')
        .insert([{
          user_id: session.user.id,
          amount: uiLang === 'zh' ? plan.price_cny : plan.price_usd,
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
          planName: plan.name,
          method: method 
        }
      });

      if (invokeError) throw invokeError;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "No redirect URL generated.");
      }

    } catch (err: any) {
      console.error("handlePay Error:", err);
      alert(uiLang === 'zh' ? `支付失败: ${err.message}` : `Payment Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl">
            <CreditCard size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {uiLang === 'zh' ? '财务中心' : 'Billing & Subscription'}
            </h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest italic">Fuel your AI business engine</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="text-right">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uiLang === 'zh' ? '剩余点数' : 'Available Credits'}</p>
             <p className="text-2xl font-black text-indigo-600">{(profile?.credits_total || 0) - (profile?.credits_used || 0)}</p>
           </div>
           <div className="w-px h-10 bg-slate-100"></div>
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{uiLang === 'zh' ? '当前计划' : 'Current Plan'}</p>
             <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase border border-indigo-100 mt-1">
               {profile?.plan_type || 'Free'}
             </span>
           </div>
        </div>
      </div>

      {!showHistory ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map(plan => {
            const isCurrent = (profile?.plan_type || 'Free') === plan.id;
            const isThisPlanProcessing = processingId === plan.id;
            const currencySym = uiLang === 'zh' ? '¥' : '$';
            const price = uiLang === 'zh' ? plan.price_cny : plan.price_usd;
            const features = uiLang === 'zh' ? plan.features_zh : plan.features;
            const displayName = uiLang === 'zh' ? plan.name_zh : plan.name;

            return (
              <div 
                key={plan.id} 
                className={`bg-white rounded-[3rem] border-2 overflow-hidden flex flex-col group transition-all relative ${
                  isCurrent 
                    ? 'border-indigo-600 shadow-2xl shadow-indigo-100 scale-105 z-10' 
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                {isCurrent && (
                  <div className="absolute top-6 right-6 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg z-20">
                    <Star size={12} /> {uiLang === 'zh' ? '当前订阅' : 'Current'}
                  </div>
                )}

                <div className="p-10 space-y-8 flex-1">
                   <div>
                      <h3 className="text-2xl font-black text-slate-900">{displayName}</h3>
                      <div className="flex items-baseline gap-1 mt-4">
                        <span className="text-4xl font-black text-slate-900">{currencySym}{price}</span>
                        <span className="text-sm text-slate-400 font-bold">/ {uiLang === 'zh' ? '月' : 'mo'}</span>
                      </div>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-4">
                        {plan.credits} {uiLang === 'zh' ? 'AI 点数' : 'Credits'} / {uiLang === 'zh' ? '月' : 'mo'}
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
                     <div className="w-full py-4 bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest text-center">
                       {uiLang === 'zh' ? '已在计划中' : 'Already Subscribed'}
                     </div>
                   ) : plan.id === 'Free' ? (
                     <div className="w-full py-4 border-2 border-slate-200 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest text-center">
                       {uiLang === 'zh' ? '免费永久' : 'Free Forever'}
                     </div>
                   ) : (
                     <div className="space-y-3">
                        {uiLang === 'zh' ? (
                          <button 
                            disabled={processingId !== null}
                            onClick={() => handlePay(plan, 'alipay')}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isThisPlanProcessing ? <Loader2 className="animate-spin" size={18} /> : <Wallet size={18} />}
                            {uiLang === 'zh' ? '使用 支付宝 升级' : 'Pay with Alipay'}
                          </button>
                        ) : (
                          <button 
                            disabled={processingId !== null}
                            onClick={() => handlePay(plan, 'paypal')}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isThisPlanProcessing ? <Loader2 className="animate-spin" size={18} /> : <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" className="h-4" />}
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
      ) : (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          {/* 订单历史表格保持原样 */}
        </div>
      )}
    </div>
  );
};
