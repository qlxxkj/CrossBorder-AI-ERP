
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

  const handleLanguageChange = (newLang: UILanguage) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
    document.documentElement.lang = newLang;
  };

  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang') as UILanguage;
    if (savedLang) {
      setLang(savedLang);
      document.documentElement.lang = savedLang;
    }
  }, []);

  // 核心修复：使用 maybeSingle() 避免找不到行时的 406 错误
  const fetchUserProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) return;
    
    console.log("Checking profile for user:", userId);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // 重要：使用 maybeSingle 不会因为 0 rows 报错
    
    if (error) {
      console.error("Supabase fetch error:", error.message);
      return;
    }

    if (!data) {
      console.warn("Profile not found in DB. Attempting auto-creation...");
      const { data: newData, error: createError } = await supabase
        .from('user_profiles')
        .insert([{ 
          id: userId, 
          plan_type: 'Free', 
          credits_total: 100, 
          credits_used: 0,
          role: 'user' 
        }])
        .select()
        .maybeSingle();
      
      if (!createError && newData) {
        setUserProfile(newData);
        console.log("Profile auto-created successfully.");
      } else if (createError) {
        console.error("Profile auto-creation failed:", createError.message);
      }
      return;
    }

    // 成功获取到数据
    if (data.is_suspended) {
      alert(lang === 'zh' ? "账户已被停用" : "Account suspended.");
      await supabase.auth.signOut();
      return;
    }
    
    setUserProfile(data);
    console.log("Current Identity:", data.role === 'admin' ? "👑 ADMINISTRATOR" : "👤 STANDARD USER");
    
    // 异步更新活跃时间
    supabase.from('user_profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId).then();
  }, [lang]);

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
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession) {
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
  }, [fetchUserProfile]);

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
      if (userProfile?.role === 'admin') {
        setView(AppView.ADMIN);
      } else {
        alert(lang === 'zh' ? "访问拒绝：非管理员账户。" : "Access Denied: Not an admin.");
        setActiveTab('dashboard');
      }
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
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Syncing Identity...</p>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {view !== AppView.LANDING && view !== AppView.AUTH && (
        <Sidebar onLogout={() => supabase.auth.signOut()} onLogoClick={() => setView(AppView.LANDING)} activeTab={activeTab} setActiveTab={handleTabChange} lang={lang} userEmail={session?.user?.email} userProfile={userProfile} />
      )}
      <main className={`${view !== AppView.LANDING && view !== AppView.AUTH ? 'ml-64' : 'w-full'} flex-1 h-screen overflow-hidden`}>
        <div className="h-full overflow-y-auto custom-scrollbar">
          {view === AppView.LANDING ? <LandingPage onLogin={() => setView(AppView.AUTH)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} onLanguageChange={handleLanguageChange} /> :
           view === AppView.AUTH ? <AuthPage onBack={() => setView(AppView.LANDING)} onLogoClick={() => setView(AppView.LANDING)} uiLang={lang} /> :
           renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
