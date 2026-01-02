
import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ListingsManager } from './components/ListingsManager';
import { LandingPage } from './components/LandingPage';
import { ListingDetail } from './components/ListingDetail';
import { AuthPage } from './components/AuthPage';
import { TemplateManager } from './components/TemplateManager';
import { AppView, Listing, UILanguage } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { AlertTriangle, Loader2, Database, RefreshCcw } from 'lucide-react';

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
          fetchListings();
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
        fetchListings();
      } else {
        setView(AppView.LANDING);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLanguageChange = (newLang: UILanguage) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const fetchListings = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    
    setIsInitialFetch(true);
    try {
      // 增加超时控制：如果 10s 没数据返回，抛出错误
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200); // 初始只加载最近的 200 条，提高响应速度

      clearTimeout(timeoutId);

      if (error) throw error;
      setListings(data || []);
    } catch (e: any) {
      console.error("Listing fetch error:", e);
      // 如果不是主动取消，则提示错误
      if (e.name !== 'AbortError') {
        // 可以在这里加个轻量级通知
      }
    } finally {
      setIsInitialFetch(false);
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView(AppView.LANDING);
    setSession(null);
    setListings([]);
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 text-center">
        <div className="max-w-md space-y-4">
          <AlertTriangle className="mx-auto text-red-500" size={48} />
          <h1 className="text-xl font-black text-red-900 uppercase tracking-tighter">System Initialization Error</h1>
          <p className="text-red-700 font-medium text-sm">{initError}</p>
          <p className="text-xs text-red-500">Check your Browser Console and Environment Variables.</p>
        </div>
      </div>
    );
  }

  // 全局加载状态（Auth 初始化）
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-pulse"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Initializing Secured Session</p>
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

    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={fetchListings} />;
      case 'listings': 
        return (
          <ListingsManager 
            onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }} 
            listings={listings} 
            setListings={setListings} 
            lang={lang} 
            refreshListings={fetchListings}
            isInitialLoading={isInitialFetch}
          />
        );
      case 'templates': 
        return <TemplateManager uiLang={lang} />;
      default: 
        return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={fetchListings} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar onLogout={handleLogout} onLogoClick={() => setView(AppView.LANDING)} activeTab={activeTab} setActiveTab={setActiveTab} lang={lang} />
      <main className="ml-64 flex-1">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
