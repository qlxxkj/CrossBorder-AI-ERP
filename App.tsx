
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ListingsManager } from './components/ListingsManager';
import { LandingPage } from './components/LandingPage';
import { ListingDetail } from './components/ListingDetail';
import { AuthPage } from './components/AuthPage';
import { TemplateManager } from './components/TemplateManager';
import { AppView, Listing, UILanguage } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { AlertTriangle, Loader2, Database, RefreshCcw, WifiOff, ShieldAlert, DatabaseZap } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialFetch, setIsInitialFetch] = useState(false);
  const [lang, setLang] = useState<UILanguage>('zh');
  const [listings, setListings] = useState<Listing[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'timeout' | 'rls_error'>('idle');
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

  const fetchAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang') as UILanguage;
    if (savedLang) setLang(savedLang);
    
    if (!isSupabaseConfigured()) {
      setInitError("Supabase configuration is missing. Please check your environment variables.");
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession) {
          setView(AppView.DASHBOARD);
          fetchListings(currentSession.user.id);
        }
      } catch (err: any) {
        setInitError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setView(AppView.DASHBOARD);
        fetchListings(session.user.id);
      } else {
        setView(AppView.LANDING);
        setListings([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLanguageChange = (newLang: UILanguage) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  /**
   * 增强型数据抓取逻辑
   */
  const fetchListings = useCallback(async (userId?: string, useDegradedMode = false) => {
    const uid = userId || session?.user?.id;
    if (!isSupabaseConfigured() || !uid) return;
    
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }
    
    fetchAbortController.current = new AbortController();
    setIsInitialFetch(true);
    setFetchStatus('loading');
    setLastErrorCode(null);

    try {
      // 1. 设置超时逻辑
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 12000)
      );

      // 2. 执行查询
      // 如果处于降级模式（degraded），移除排序以减轻数据库 RLS 过滤负载
      let query = supabase
        .from('listings')
        .select('*')
        .eq('user_id', uid);

      if (!useDegradedMode) {
        query = query.order('created_at', { ascending: false });
      }

      const fetchPromise = query.limit(200);

      const response: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (response.error) {
        // 特殊处理 RLS 错误 (Postgres Error Code 42501)
        if (response.error.code === '42501') {
          setFetchStatus('rls_error');
          throw response.error;
        }
        throw response.error;
      }
      
      setListings(response.data || []);
      setFetchStatus('success');
    } catch (e: any) {
      console.error("Listing fetch failed:", e);
      if (e.message === 'TIMEOUT') {
        setFetchStatus('timeout');
        // 第一次超时时，尝试自动降级查询（不排序查询）
        if (!useDegradedMode) {
          console.warn("Retrying with degraded query (no ordering)...");
          fetchListings(uid, true);
        }
      } else if (e.name !== 'AbortError') {
        setLastErrorCode(e.code || e.message);
        if (fetchStatus !== 'rls_error') setFetchStatus('error');
      }
    } finally {
      setIsInitialFetch(false);
    }
  }, [session, fetchStatus]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView(AppView.LANDING);
    setSession(null);
    setListings([]);
    setFetchStatus('idle');
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 text-center">
        <div className="max-w-md space-y-4">
          <AlertTriangle className="mx-auto text-red-500" size={48} />
          <h1 className="text-xl font-black text-red-900 uppercase tracking-tighter">System Initialization Error</h1>
          <p className="text-red-700 font-medium text-sm">{initError}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Retry Connection</button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-pulse"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Authenticating Session</p>
    </div>
  );

  if (view === AppView.LANDING) {
    return (
      <LandingPage 
        onLogin={() => setView(session ? AppView.DASHBOARD : AppView.AUTH)} 
        onLogoClick={() => setView(AppView.LANDING)}
        uiLang={lang} 
        onLanguageChange={handleLanguageChange} 
      />
    );
  }

  if (view === AppView.AUTH) return <AuthPage onBack={() => setView(AppView.LANDING)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} />;

  const renderContent = () => {
    if (view === AppView.LISTING_DETAIL && selectedListing) {
      return (
        <ListingDetail 
          listing={selectedListing} 
          onBack={() => { setView(AppView.DASHBOARD); fetchListings(); }}
          onUpdate={(updated) => {
            setListings(prev => prev.map(l => l.id === updated.id ? updated : l));
            setSelectedListing(updated);
          }}
          onNext={() => {
            const idx = listings.findIndex(l => l.id === selectedListing.id);
            const next = listings[(idx + 1) % listings.length];
            setSelectedListing(next);
            window.scrollTo(0,0);
          }}
          uiLang={lang}
        />
      );
    }

    // 处理加载异常状态
    if (fetchStatus === 'timeout' || fetchStatus === 'error' || fetchStatus === 'rls_error') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-8 animate-in zoom-in-95">
          <div className="relative">
            <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl rotate-3 transition-transform hover:rotate-0 ${
              fetchStatus === 'rls_error' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
            }`}>
               {fetchStatus === 'rls_error' ? <ShieldAlert size={48} /> : (fetchStatus === 'timeout' ? <DatabaseZap size={48} /> : <WifiOff size={48} />)}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg border border-slate-100">
               <AlertTriangle size={16} className="text-red-500" />
            </div>
          </div>

          <div className="space-y-3 max-w-md">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {fetchStatus === 'rls_error' ? 'RLS Access Denied' : (fetchStatus === 'timeout' ? 'Database Timeout' : 'Sync Failed')}
            </h3>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              {fetchStatus === 'rls_error' 
                ? "Your user role does not have permission to view these records. Please ensure Row Level Security (RLS) policies are correctly configured on Supabase." 
                : fetchStatus === 'timeout' 
                  ? "Large data volume detected. The query took too long to resolve. We recommend adding an index to 'user_id' in your Supabase table."
                  : `An unexpected error occurred: ${lastErrorCode || 'Unknown Error'}`}
            </p>
          </div>

          <div className="flex gap-4">
             <button 
                onClick={() => fetchListings()}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 hover:bg-slate-800 transition-all active:scale-95"
              >
                <RefreshCcw size={16} /> Force Reload
              </button>
              {fetchStatus === 'timeout' && (
                <button 
                  onClick={() => fetchListings(undefined, true)}
                  className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 transition-all"
                >
                  Load Without Sorting
                </button>
              )}
          </div>
          
          <div className="pt-8 border-t border-slate-100 flex items-center gap-6">
             <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-300 uppercase">Latency</span>
                <span className="text-xs font-bold text-slate-500">12,000ms+</span>
             </div>
             <div className="w-px h-8 bg-slate-100"></div>
             <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-300 uppercase">Provider</span>
                <span className="text-xs font-bold text-slate-500">Supabase DB</span>
             </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={() => fetchListings()} />;
      case 'listings': 
        return (
          <ListingsManager 
            onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }} 
            listings={listings} 
            setListings={setListings} 
            lang={lang} 
            refreshListings={() => fetchListings()}
            isInitialLoading={isInitialFetch}
          />
        );
      case 'templates': 
        return <TemplateManager uiLang={lang} />;
      default: 
        return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={() => fetchListings()} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onLogout={handleLogout} onLogoClick={() => setView(AppView.LANDING)} activeTab={activeTab} setActiveTab={setActiveTab} lang={lang} />
      <main className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
