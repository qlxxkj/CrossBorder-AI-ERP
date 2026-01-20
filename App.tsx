
import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2 } from 'lucide-react';

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

  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang') as UILanguage;
    if (savedLang) setLang(savedLang);
  }, []);

  const fetchUserProfile = async (userId: string) => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      if (data.is_suspended) {
        alert("账户已被停用，请联系客服。");
        await supabase.auth.signOut();
        return;
      }
      setUserProfile(data);
      await supabase.from('user_profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
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
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchListings = useCallback(async (userId?: string) => {
    const uid = userId || session?.user?.id;
    if (!isSupabaseConfigured() || !uid) return;
    setIsInitialFetch(true);
    try {
      const { data } = await supabase.from('listings').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      setListings(data || []);
    } catch (e) { console.error(e); } finally { setIsInitialFetch(false); }
  }, [session]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'admin') {
      setView(AppView.ADMIN);
    } else {
      setView(AppView.DASHBOARD);
    }
  };

  const renderContent = () => {
    if (view === AppView.ADMIN && userProfile?.role === 'admin') {
      return <AdminDashboard uiLang={lang} />;
    }
    if (view === AppView.LISTING_DETAIL && selectedListing) {
      return <ListingDetail listing={selectedListing} onBack={() => { setView(AppView.DASHBOARD); fetchListings(); }} onUpdate={(u) => setListings(prev => prev.map(l => l.id === u.id ? u : l))} onNext={() => {}} uiLang={lang} />;
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard listings={listings} lang={lang} isSyncing={isInitialFetch} onRefresh={() => fetchListings()} userProfile={userProfile} onNavigate={handleTabChange} />;
      case 'listings': return <ListingsManager onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }} listings={listings} setListings={setListings} lang={lang} refreshListings={() => fetchListings()} />;
      case 'categories': return <CategoryManager uiLang={lang} />;
      case 'pricing': return <PricingManager uiLang={lang} />;
      case 'templates': return <TemplateManager uiLang={lang} />;
      case 'billing': return <BillingCenter uiLang={lang} />;
      case 'admin': 
        if (userProfile?.role === 'admin') return <AdminDashboard uiLang={lang} />;
        return <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} />;
      default: return <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} />;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fueling AMZBot...</p>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {view !== AppView.LANDING && view !== AppView.AUTH && (
        <Sidebar onLogout={() => supabase.auth.signOut()} onLogoClick={() => setView(AppView.LANDING)} activeTab={activeTab} setActiveTab={handleTabChange} lang={lang} userEmail={session?.user?.email} userProfile={userProfile} />
      )}
      <main className={`${view !== AppView.LANDING && view !== AppView.AUTH ? 'ml-64' : 'w-full'} flex-1 h-screen overflow-hidden`}>
        <div className="h-full overflow-y-auto custom-scrollbar">
          {view === AppView.LANDING ? <LandingPage onLogin={() => setView(AppView.AUTH)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} onLanguageChange={(l) => setLang(l)} /> :
           view === AppView.AUTH ? <AuthPage onBack={() => setView(AppView.LANDING)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} /> :
           renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
