
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Loader2, ArrowLeft, MessageCircle } from 'lucide-react';
import { UILanguage } from '../types';
import { useTranslation } from '../lib/i18n';

interface AuthPageProps {
  onBack: () => void;
  onLogoClick: () => void;
  uiLang: UILanguage;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onBack, onLogoClick, uiLang }) => {
  const t = useTranslation(uiLang);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Authentication failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'wechat') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <button onClick={onBack} className="absolute top-8 left-8 flex items-center text-slate-500 hover:text-slate-800 transition-colors font-bold uppercase text-xs tracking-widest">
        <ArrowLeft size={18} className="mr-2" /> {t('back')}
      </button>

      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-10">
          <div className="text-center mb-10">
            <button 
              onClick={onLogoClick}
              className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl text-white font-black text-2xl mb-6 shadow-xl shadow-blue-100 hover:scale-105 transition-transform"
            >
              A
            </button>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {isSignUp ? t('authCreate') : t('authWelcome')}
            </h2>
            <p className="text-slate-400 text-sm mt-3 font-medium">
              {isSignUp ? t('authStartSub') : t('authSignInSub')}
            </p>
          </div>

          <div className="space-y-3 mb-8">
            <button
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center justify-center gap-3 py-3.5 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-700 bg-white active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t('googleLogin')}
            </button>
            <button
              onClick={() => handleSocialLogin('wechat')}
              className="w-full flex items-center justify-center gap-3 py-3.5 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-700 bg-white active:scale-95"
            >
              <MessageCircle className="text-green-600" size={20} />
              {t('wechatLogin')}
            </button>
          </div>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="bg-white px-4 text-slate-400 font-black">{t('orEmail')}</span>
            </div>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('emailAddr')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-700"
                  placeholder="name@company.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-slate-700"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? t('signUp') : t('signIn'))}
            </button>
          </form>
        </div>

        <div className="bg-slate-50/80 p-6 text-center text-xs border-t border-slate-100">
          <span className="text-slate-400 font-bold">
            {isSignUp ? t('alreadyHaveAccount') : t('noAccount')}
          </span>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-2 font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest"
          >
            {isSignUp ? t('signIn') : t('signUp')}
          </button>
        </div>
      </div>
    </div>
  );
};
