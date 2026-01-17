
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ListingsManager } from './components/ListingsManager';
import { LandingPage } from './components/LandingPage';
import { ListingDetail } from './components/ListingDetail';
import { AuthPage } from './components/AuthPage';
import { TemplateManager } from './components/TemplateManager';
import { CategoryManager } from './components/CategoryManager';
import { PricingManager } from './components/PricingManager';
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
          // 只在初始加载时根据当前视图状态决定是否设为 DASHBOARD
          // 避免切换程序回来时重置视图
          if (view === AppView.LANDING) {
            setView(AppView.DASHBOARD);
          }
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
        if (view === AppView.LANDING || view === AppView.AUTH) {
          setView(AppView.DASHBOARD);
        }
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

      let query = mode === 'extreme' 
        ? supabase.from('listings').select('id, asin, marketplace, category_id, status, created_at, cleaned, user_id, translations, exported_marketplaces')
        : supabase.from('listings').select('*');

      query = query.eq('user_id', uid).order('created_at', { ascending: false });

      const response: any = await Promise.race([query.limit(500), timeoutPromise]);
      
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
      if (e.message === 'TIMEOUT') setFetchStatus('db_limit');
      else if (e.name !== 'AbortError') setFetchStatus('error');
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // 当点击侧边栏菜单时，如果当前在详情页，则退出详情页返回主视图
    if (view === AppView.LISTING_DETAIL) {
      setView(AppView.DASHBOARD);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Establishing Connection</p>
    </div>
  );

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
          }}
          uiLang={lang}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={() => fetchListings()} />;
      case 'listings': return <ListingsManager onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }} listings={listings} setListings={setListings} lang={lang} refreshListings={() => fetchListings()} isInitialLoading={isInitialFetch} />;
      case 'categories': return <CategoryManager uiLang={lang} />;
      case 'pricing': return <PricingManager uiLang={lang} />;
      case 'templates': return <TemplateManager uiLang={lang} />;
      default: return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={() => fetchListings()} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {view !== AppView.LANDING && view !== AppView.AUTH && (
        <Sidebar onLogout={handleLogout} onLogoClick={() => setView(AppView.LANDING)} activeTab={activeTab} setActiveTab={handleTabChange} lang={lang} />
      )}
      <main className={`${view !== AppView.LANDING && view !== AppView.AUTH ? 'ml-64' : 'w-full'} flex-1 flex flex-col h-screen overflow-hidden`}>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {view === AppView.LANDING ? (
             <LandingPage onLogin={() => setView(session ? AppView.DASHBOARD : AppView.AUTH)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} onLanguageChange={handleLanguageChange} />
           ) : view === AppView.AUTH ? (
             <AuthPage onBack={() => setView(AppView.LANDING)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} />
           ) : renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
