
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
import { AlertTriangle, Loader2, Database, RefreshCcw, ShieldAlert, DatabaseZap, WifiOff, CloudOff } from 'lucide-react';

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

      const fetchPromise = query.limit(500);
      const response: any = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (response.error) {
        setLastError(response.error);
        if (response.error.code === '57014') setFetchStatus('db_limit');
        else if (response.error.code === '42501') setFetchStatus('rls_error');
        else setFetchStatus('error');
        return;
      }
      
      setListings(response.data || []);
      setFetchStatus('success');
    } catch (e: any) {
      if (e.message === 'TIMEOUT') {
        setFetchStatus('db_limit');
        setLastError({ message: "Request timed out. The data set might be too large." });
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
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto">
          <div className="relative group">
            <div className={`w-32 h-32 rounded-[3rem] flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 duration-500 ${
              fetchStatus === 'rls_error' ? 'bg-red-50 text-red-500 ring-8 ring-red-50/50' : 'bg-amber-50 text-amber-500 ring-8 ring-amber-50/50'
            }`}>
               {fetchStatus === 'rls_error' ? <ShieldAlert size={56} /> : <CloudOff size={56} />}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
              {fetchStatus === 'rls_error' ? 'Access Restricted' : 'Sync Interrupted'}
            </h3>
            <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
              {fetchStatus === 'rls_error' 
                ? "We couldn't retrieve your data due to security restrictions. Please contact support or check your account permissions."
                : "The data cloud is taking a bit longer than usual to respond. This can happen with very large inventory sets."}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
             <button 
                onClick={() => fetchListings(undefined, 'normal')}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 transition-all flex items-center gap-3"
              >
                <RefreshCcw size={16} /> {lang === 'zh' ? '重新连接' : 'Retry Sync'}
              </button>
              <button 
                onClick={() => fetchListings(undefined, 'extreme')}
                className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-3"
              >
                <DatabaseZap size={16} /> {lang === 'zh' ? '极速模式' : 'Extreme Lite Mode'}
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
