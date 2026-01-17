
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
import { AlertTriangle, Loader2 } from 'lucide-react';

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
      setInitError("Supabase configuration is missing.");
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession) {
          if (view === AppView.LANDING) setView(AppView.DASHBOARD);
          fetchListings(currentSession.user.id);
        }
      } catch (err: any) {
        setInitError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        // 只有当从外部进入或从 Auth 进入时才重置视图，防止切换程序回来导致的详情页消失
        if (view === AppView.LANDING || view === AppView.AUTH) {
          setView(AppView.DASHBOARD);
        }
        if (event === 'SIGNED_IN') fetchListings(session.user.id);
      } else {
        setView(AppView.LANDING);
        setListings([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [view]);

  const handleLanguageChange = (newLang: UILanguage) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const fetchListings = useCallback(async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!isSupabaseConfigured() || !uid) return;
    
    setIsInitialFetch(true);
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setListings(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsInitialFetch(false);
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView(AppView.LANDING);
    setSession(null);
    setListings([]);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // 关键修复：点击其他菜单时，强制重置 View 模式，以便渲染对应 Tab 的内容
    setView(AppView.DASHBOARD);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Establishing Connection</p>
    </div>
  );

  const renderContent = () => {
    // 只有当 View 是 LISTING_DETAIL 时才渲染详情页，确保 Tab 切换优先级更高
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
