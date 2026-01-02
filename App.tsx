
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
import { AlertTriangle, Loader2, Database, RefreshCcw, WifiOff, ShieldAlert, DatabaseZap, Copy, Terminal, Check } from 'lucide-react';

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
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'timeout' | 'rls_error' | 'db_limit'>('idle');
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
   * 极速数据抓取逻辑，针对 57014 错误特别优化
   */
  const fetchListings = useCallback(async (userId?: string, mode: 'normal' | 'light' | 'extreme' = 'normal') => {
    const uid = userId || session?.user?.id;
    if (!isSupabaseConfigured() || !uid) return;
    
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }
    
    fetchAbortController.current = new AbortController();
    setIsInitialFetch(true);
    setFetchStatus('loading');
    setLastErrorCode(null);

    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 15000)
      );

      // 根据模式调整查询复杂度
      // normal: 全部字段 + 排序
      // light: 全部字段 + 无排序
      // extreme: 仅必要字段 + 无排序 (解决 57014 最终手段)
      let query;
      if (mode === 'extreme') {
        query = supabase
          .from('listings')
          .select('id, asin, marketplace, status, created_at, cleaned->title, cleaned->main_image')
          .eq('user_id', uid);
      } else {
        query = supabase
          .from('listings')
          .select('*')
          .eq('user_id', uid);
      }

      if (mode === 'normal') {
        query = query.order('created_at', { ascending: false });
      }

      const fetchPromise = query.limit(100);

      const response: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (response.error) {
        // 捕获 57014 (query_canceled)
        if (response.error.code === '57014') {
          setFetchStatus('db_limit');
          throw response.error;
        }
        if (response.error.code === '42501') {
          setFetchStatus('rls_error');
          throw response.error;
        }
        throw response.error;
      }
      
      console.log(`Fetch completed in ${Date.now() - startTime}ms mode: ${mode}`);
      setListings(response.data || []);
      setFetchStatus('success');
    } catch (e: any) {
      console.error("Fetch failed:", e);
      if (e.message === 'TIMEOUT' || e.code === '57014') {
        setFetchStatus('db_limit');
        setLastErrorCode(e.code || 'TIMEOUT');
      } else if (e.name !== 'AbortError') {
        setLastErrorCode(e.code || e.message);
        if (fetchStatus !== 'rls_error') setFetchStatus('error');
      }
    } finally {
      setIsInitialFetch(false);
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView(AppView.LANDING);
    setSession(null);
    setListings([]);
    setFetchStatus('idle');
  };

  const copySql = () => {
    const sql = `CREATE INDEX IF NOT EXISTS idx_listings_user_id_created_at ON listings (user_id, created_at DESC);`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 text-center">
        <div className="max-w-md space-y-4">
          <AlertTriangle className="mx-auto text-red-500" size={48} />
          <h1 className="text-xl font-black text-red-900 uppercase tracking-tighter">Initialization Error</h1>
          <p className="text-red-700 font-medium text-sm">{initError}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Retry</button>
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
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Establishing Connection</p>
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

    if (fetchStatus === 'db_limit' || fetchStatus === 'error' || fetchStatus === 'rls_error') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
          <div className="relative">
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-xl ${
              fetchStatus === 'db_limit' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'
            }`}>
               {fetchStatus === 'db_limit' ? <DatabaseZap size={40} /> : <ShieldAlert size={40} />}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-lg shadow-md border border-slate-100">
               <AlertTriangle size={14} className="text-red-500" />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {fetchStatus === 'db_limit' ? 'Database Performance Limit' : 'Access Restricted'}
            </h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md mx-auto">
              {fetchStatus === 'db_limit' 
                ? "The query was canceled (Error 57014). This usually means you have a large amount of data and the database is missing necessary indexes to filter by user_id efficiently."
                : "Security policies (RLS) are preventing data retrieval. Ensure your 'listings' table has a policy allowing SELECT for authenticated users."}
            </p>
          </div>

          {fetchStatus === 'db_limit' && (
            <div className="w-full max-w-2xl bg-slate-900 rounded-3xl p-6 text-left space-y-4 border border-slate-800 shadow-2xl overflow-hidden relative">
               <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                    <Terminal size={14} /> Recommended SQL Fix
                  </span>
                  <button 
                    onClick={copySql}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black transition-all"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy SQL'}
                  </button>
               </div>
               <code className="block font-mono text-xs text-slate-300 bg-black/30 p-4 rounded-xl border border-white/5 break-all leading-relaxed">
                 CREATE INDEX IF NOT EXISTS idx_listings_user_id_created_at <br/>
                 ON listings (user_id, created_at DESC);
               </code>
               <p className="text-[10px] font-bold text-slate-500 italic">
                 * Paste this into your Supabase SQL Editor and run it to boost performance.
               </p>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-4">
             <button 
                onClick={() => fetchListings(undefined, 'normal')}
                className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
              >
                <RefreshCcw size={14} /> Normal Retry
              </button>
              <button 
                onClick={() => fetchListings(undefined, 'extreme')}
                className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Database size={14} /> Extreme Light Mode
              </button>
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
