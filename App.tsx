
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
import { BillingCenter } from './components/BillingCenter';
import { AdminDashboard } from './components/AdminDashboard';
import { AppView, Listing, UILanguage, UserProfile } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { AlertTriangle, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialFetch, setIsInitialFetch] = useState(false);
  const [lang, setLang] = useState<UILanguage>('zh');
  const [listings, setListings] = useState<Listing[]>([]);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang') as UILanguage;
    if (savedLang) setLang(savedLang);
  }, []);

  const fetchUserProfile = async (userId: string) => {
    if (!isSupabaseConfigured()) return;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      if (data.is_suspended) {
        alert("Your account is suspended. Contact support.");
        await supabase.auth.signOut();
        return;
      }
      setUserProfile(data);
      // 更新最后登录时间
      await supabase.from('user_profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setInitError("Supabase configuration is missing.");
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        setView(AppView.DASHBOARD);
        fetchListings(currentSession.user.id);
        fetchUserProfile(currentSession.user.id);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Auth init error:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_IN' && newSession) {
        setView(AppView.DASHBOARD);
        fetchListings(newSession.user.id);
        fetchUserProfile(newSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setView(AppView.LANDING);
        setListings([]);
        setSelectedListing(null);
        setUserProfile(null);
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
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (view === AppView.LISTING_DETAIL || view === AppView.ADMIN) {
      setView(AppView.DASHBOARD);
    }
  };

  const handleLoginClick = () => {
    if (session) setView(AppView.DASHBOARD);
    else setView(AppView.AUTH);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-16 h-16 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Initializing AMZBot</p>
    </div>
  );

  const renderContent = () => {
    if (view === AppView.ADMIN && userProfile?.role === 'admin') {
      return <AdminDashboard uiLang={lang} />;
    }
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
      case 'billing': return <BillingCenter uiLang={lang} />;
      case 'admin': 
        if (userProfile?.role === 'admin') {
          setView(AppView.ADMIN);
          return null;
        }
        return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={() => fetchListings()} />;
      default: return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={() => fetchListings()} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {view !== AppView.LANDING && view !== AppView.AUTH && (
        <Sidebar 
          onLogout={handleLogout} 
          onLogoClick={() => setView(AppView.LANDING)} 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          lang={lang} 
          userEmail={session?.user?.email}
          userProfile={userProfile}
        />
      )}
      
      <main className={`${view !== AppView.LANDING && view !== AppView.AUTH ? 'ml-64' : 'w-full'} flex-1 flex flex-col h-screen overflow-hidden`}>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {view === AppView.LANDING ? (
             <LandingPage onLogin={handleLoginClick} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} onLanguageChange={handleLanguageChange} />
           ) : view === AppView.AUTH ? (
             <AuthPage onBack={() => setView(AppView.LANDING)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} />
           ) : (
             renderContent()
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
