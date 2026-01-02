
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
import { AlertTriangle, Loader2, Database, RefreshCcw, WifiOff, ShieldAlert, DatabaseZap, Copy, Terminal, Check, Info } from 'lucide-react';

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
  const [lastError, setLastError] = useState<{code?: string, message?: string, hint?: string} | null>(null);
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

  const fetchListings = useCallback(async (userId?: string, mode: 'normal' | 'extreme' = 'normal') => {
    const uid = userId || session?.user?.id;
    if (!isSupabaseConfigured() || !uid) return;
    
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }
    
    fetchAbortController.current = new AbortController();
    setIsInitialFetch(true);
    setFetchStatus('loading');
    setLastError(null);

    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 15000)
      );

      // 如果 100 条数据就报错，很有可能是 raw 字段（原始网页代码）太大了导致传输超时
      // extreme 模式会排除掉 raw 和 description 等大字段
      let query;
      if (mode === 'extreme') {
        query = supabase
          .from('listings')
          .select('id, asin, marketplace, status, created_at, cleaned, user_id')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
      } else {
        query = supabase
          .from('listings')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
      }

      const fetchPromise = query.limit(200);

      const response: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (response.error) {
        setLastError(response.error);
        if (response.error.code === '57014') {
          setFetchStatus('db_limit');
        } else if (response.error.code === '42501') {
          setFetchStatus('rls_error');
        } else {
          setFetchStatus('error');
        }
        return;
      }
      
      setListings(response.data || []);
      setFetchStatus('success');
    } catch (e: any) {
      if (e.message === 'TIMEOUT') {
        setFetchStatus('db_limit');
        setLastError({ message: "Request timed out after 15 seconds." });
      } else if (e.name !== 'AbortError') {
        setFetchStatus('error');
        setLastError({ message: e.message });
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
    const sql = `CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings (user_id);`;
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
      <Loader2 className="animate-spin text-indigo-600" size={32} />
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
            if (idx === -1) return;
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
              fetchStatus === 'rls_error' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
            }`}>
               {fetchStatus === 'rls_error' ? <ShieldAlert size={40} /> : <DatabaseZap size={40} />}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {fetchStatus === 'rls_error' ? 'Access Denied (RLS)' : 'Connection Interrupted'}
            </h3>
            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 text-left">
              <p className="text-red-800 text-xs font-mono break-all">
                <strong>Error {lastError?.code}:</strong> {lastError?.message}
                {lastError?.hint && <span className="block mt-2 text-red-600 opacity-70 italic">Hint: {lastError.hint}</span>}
              </p>
            </div>
            <p className="text-slate-500 text-sm font-medium max-w-md mx-auto">
              {fetchStatus === 'rls_error' 
                ? "Your database's Row Level Security is blocking the query. This usually happens if the policy is not set to 'Allow SELECT for authenticated users'."
                : "The database took too long to respond. Even with 100 rows, this can happen if the 'raw' HTML content for each row is too large."}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
             <button 
                onClick={() => fetchListings(undefined, 'normal')}
                className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all"
              >
                <RefreshCcw size={14} /> Normal Retry
              </button>
              <button 
                onClick={() => fetchListings(undefined, 'extreme')}
                className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-indigo-700 transition-all"
              >
                <Database size={14} /> Extreme Light Mode
              </button>
          </div>

          <div className="w-full max-w-2xl bg-slate-900 rounded-3xl p-6 text-left space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Diagnostic SQL Fix</span>
                <button onClick={copySql} className="text-slate-400 hover:text-white text-[10px] font-bold flex items-center gap-1">
                  {copied ? <Check size={12} className="text-green-400"/> : <Copy size={12}/>} {copied ? 'Copied' : 'Copy'}
                </button>
             </div>
             <code className="block font-mono text-xs text-slate-300 bg-black/30 p-4 rounded-xl">
               -- 1. Create essential index <br/>
               CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings (user_id);<br/><br/>
               -- 2. Verify RLS Policy (Run this to see policies)<br/>
               SELECT * FROM pg_policies WHERE tablename = 'listings';
             </code>
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
