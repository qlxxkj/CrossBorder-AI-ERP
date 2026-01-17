
import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Check, Zap, Crown, ShieldCheck, 
  Loader2, Wallet, ExternalLink, ArrowRight, History, AlertCircle, Clock, 
  Terminal, ShieldAlert, WifiOff, FileSearch
} from 'lucide-react';
import { UILanguage, UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface BillingCenterProps {
  uiLang: UILanguage;
}

const PLANS = [
  {
    id: 'Pro',
    name: 'Growth',
    price: 29,
    credits: 2000,
    features: ['Unlimited Product Collect', '2,000 AI Credits', 'Visual 1688 Search', 'Priority Support'],
    color: 'blue'
  },
  {
    id: 'Elite',
    name: 'Elite',
    price: 79,
    credits: 10000,
    features: ['5 User Collaboration', '10,000 AI Credits', 'Custom Template Export', 'Full API Access'],
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
    setProcessingId(plan.id);
    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase URL or Key missing in .env");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(uiLang === 'zh' ? "请先登录后再充值" : "Please sign in first.");

      // 1. 创建本地订单记录
      const { data: order, error: orderError } = await supabase
        .from('payment_orders')
        .insert([{
          user_id: session.user.id,
          amount: plan.price,
          plan_id: plan.id,
          provider: method,
          currency: 'CNY',
          status: 'pending'
        }])
        .select().single();

      if (orderError) {
        throw new Error(uiLang === 'zh' ? `订单创建失败。请确保数据库包含 'payment_orders' 表。` : `Order table missing.`);
      }

      // 2. 调用 Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke('create-payment', {
        body: { 
          orderId: order.id, 
          amount: plan.price, 
          planName: plan.name,
          method: method 
        }
      });

      // 如果返回了非 200 错误
      if (invokeError) {
        // 尝试从错误体中提取后端抛出的具体异常
        let errorMsg = invokeError.message;
        try {
          // 如果返回的是 JSON 错误
          const body = await (invokeError as any).context?.response?.json();
          if (body?.error) errorMsg = body.error;
        } catch (e) {}

        throw new Error(errorMsg || "Payment interface failed to respond.");
      }

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

  if (connError === "DATABASE_MISSING") {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-20 text-center space-y-6 animate-in zoom-in-95">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
          <FileSearch size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">数据库表未就绪</h2>
        <p className="text-slate-500 font-medium">
          系统检测到您的 Supabase 数据库中缺失 <code className="bg-slate-100 px-2 py-0.5 rounded text-red-600">user_profiles</code> 表，导致无法读取您的余额和套餐信息。
        </p>
        <div className="p-6 bg-slate-900 rounded-2xl text-left font-mono text-xs text-indigo-300">
          <p>-- 请在 Supabase SQL Editor 执行：</p>
          <p className="mt-2 text-white">create table user_profiles ( id uuid references auth.users not null primary key, plan_type text default 'Free', credits_total int default 0, credits_used int default 0 );</p>
        </div>
        <button onClick={fetchData} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 mx-auto">
          <RefreshCw size={16} /> 重新检查连接
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24">
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
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Credits</p>
             <p className="text-2xl font-black text-indigo-600">{(profile?.credits_total || 0) - (profile?.credits_used || 0)}</p>
           </div>
           <div className="w-px h-10 bg-slate-100"></div>
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Plan</p>
             <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase border border-indigo-100 mt-1">
               {profile?.plan_type || 'Free'}
             </span>
           </div>
        </div>
      </div>

      {!showHistory ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {PLANS.map(plan => {
            const isThisPlanProcessing = processingId === plan.id;
            return (
              <div key={plan.id} className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:border-indigo-200 transition-all">
                <div className="p-10 space-y-6 flex-1">
                   <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900">{plan.name}</h3>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Best for Power Sellers</p>
                      </div>
                      <div className="text-right">
                        <span className="text-4xl font-black text-slate-900">${plan.price}</span>
                        <span className="text-sm text-slate-400 font-bold ml-1">/mo</span>
                      </div>
                   </div>

                   <div className="space-y-4">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Check size={12} strokeWidth={3} />
                          </div>
                          <span className="text-sm font-bold text-slate-600">{f}</span>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100">
                   {uiLang === 'zh' ? (
                     <button 
                      disabled={processingId !== null}
                      onClick={() => handlePay(plan, 'alipay')}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                     >
                       {isThisPlanProcessing ? (
                         <>
                           <Loader2 className="animate-spin" size={18} />
                           正在启动安全连接...
                         </>
                       ) : (
                         <>
                           <Wallet size={18} />
                           使用 支付宝 支付
                         </>
                       )}
                     </button>
                   ) : (
                     <button 
                      disabled={processingId !== null}
                      onClick={() => handlePay(plan, 'paypal')}
                      className="w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                     >
                       {isThisPlanProcessing ? <Loader2 className="animate-spin" size={18} /> : (
                         <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" className="h-4" alt="PayPal" />
                       )}
                       Pay with PayPal
                     </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">Recent Transactions</h3>
            <button onClick={() => setShowHistory(false)} className="text-sm font-black text-indigo-600 uppercase hover:underline">Back to Plans</button>
          </div>
          <div className="overflow-x-auto">
            {orders.length === 0 ? (
              <div className="p-20 text-center text-slate-300 flex flex-col items-center gap-4">
                <Clock size={48} className="opacity-20" />
                <p className="font-black uppercase tracking-widest text-xs">No transaction history found</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="p-6">Order ID</th>
                    <th className="p-6">Plan</th>
                    <th className="p-6">Amount</th>
                    <th className="p-6">Method</th>
                    <th className="p-6">Status</th>
                    <th className="p-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map(order => (
                    <tr key={order.id} className="text-sm font-bold text-slate-600">
                      <td className="p-6 font-mono text-[10px] text-slate-400">#{order.id.slice(0,8)}</td>
                      <td className="p-6"><span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px]">{order.plan_id}</span></td>
                      <td className="p-6 text-slate-900">${order.amount}</td>
                      <td className="p-6 uppercase text-[10px]">{order.provider}</td>
                      <td className="p-6">
                        <span className={`px-2 py-1 rounded-lg text-[10px] uppercase ${
                          order.status === 'completed' ? 'bg-green-100 text-green-700' : 
                          order.status === 'pending' ? 'bg-amber-100 text-amber-700 animate-pulse' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-6 text-[10px] text-slate-400">{new Date(order.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full group-hover:scale-125 transition-transform duration-1000"></div>
         <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center text-blue-400 border border-white/5 shadow-inner">
            <ShieldCheck size={40} />
         </div>
         <div className="flex-1 space-y-2">
            <h4 className="text-xl font-black tracking-tight">{uiLang === 'zh' ? '安全支付与保障' : 'Secure Payment Guarantee'}</h4>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              {uiLang === 'zh' 
                ? '我们所有的交易都通过行业标准的加密网关处理。如果您支付后 5 分钟内额度未更新，请通过订单历史联系我们的技术支持。'
                : 'All transactions are processed via secure gateways. If your credits are not updated within 5 minutes, please contact support via history.'}
            </p>
         </div>
         <button onClick={() => setShowHistory(!showHistory)} className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
           <History size={16} /> {showHistory ? 'View Plans' : 'History'}
         </button>
      </div>
    </div>
  );
};

const RefreshCw = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
);
