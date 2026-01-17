
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

  // 语言初始化
  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang') as UILanguage;
    if (savedLang) setLang(savedLang);
  }, []);

  // 身份验证监听器：仅在挂载时运行一次
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setInitError("Supabase configuration is missing.");
      setLoading(false);
      return;
    }

    // 获取初始 Session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        // 如果已登录，默认视图设为 DASHBOARD，但之后允许用户切回 LANDING
        setView(AppView.DASHBOARD);
        fetchListings(currentSession.user.id);
      }
      setLoading(false);
    }).catch(err => {
      setInitError(err.message);
      setLoading(false);
    });

    // 监听状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      
      if (event === 'SIGNED_IN' && newSession) {
        setView(AppView.DASHBOARD);
        fetchListings(newSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setView(AppView.LANDING);
        setListings([]);
        setSelectedListing(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      console.error("Fetch failed:", e);
    } finally {
      setIsInitialFetch(false);
    }
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange 会处理视图重置
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // 切换 Tab 时确保处于 DASHBOARD 视图模式
    setView(AppView.DASHBOARD);
  };

  const handleLoginClick = () => {
    if (session) {
      setView(AppView.DASHBOARD);
    } else {
      setView(AppView.AUTH);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Establishing Connection</p>
    </div>
  );

  const renderContent = () => {
    // 详情页视图
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

    // 根据 activeTab 渲染对应的主功能组件
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
      {/* 侧边栏仅在非 Landing/Auth 视图下显示 */}
      {view !== AppView.LANDING && view !== AppView.AUTH && (
        <Sidebar 
          onLogout={handleLogout} 
          onLogoClick={() => setView(AppView.LANDING)} 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          lang={lang} 
        />
      )}
      
      <main className={`${view !== AppView.LANDING && view !== AppView.AUTH ? 'ml-64' : 'w-full'} flex-1 flex flex-col h-screen overflow-hidden`}>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {view === AppView.LANDING ? (
             <LandingPage 
               onLogin={handleLoginClick} 
               onLogoClick={() => setView(AppView.LANDING)} 
               uiLang={lang} 
               onLanguageChange={handleLanguageChange} 
             />
           ) : view === AppView.AUTH ? (
             <AuthPage 
               onBack={() => setView(AppView.LANDING)} 
               onLogoClick={() => setView(AppView.LANDING)} 
               uiLang={lang} 
             />
           ) : (
             renderContent()
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
