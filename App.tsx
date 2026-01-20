
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

  // 1. 语言切换与同步逻辑
  const handleLanguageChange = (newLang: UILanguage) => {
    console.log("Switching language to:", newLang);
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

  // 2. 深度修复：自动创建缺失的用户档案
  const fetchUserProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) return;
    
    // 尝试获取档案
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && (error.code === 'PGRST116' || error.status === 406)) {
      console.warn("Profile missing (PGRST116), creating a new one for user:", userId);
      // 如果不存在，自动创建一个初始档案
      const { data: newData, error: createError } = await supabase
        .from('user_profiles')
        .insert([{ 
          id: userId, 
          plan_type: 'Free', 
          credits_total: 30, 
          credits_used: 0,
          role: 'user' 
        }])
        .select()
        .single();
      
      if (!createError && newData) {
        setUserProfile(newData);
        console.log("New Profile Created. Role is currently 'user'. Please re-run your SQL UPDATE now.");
      }
      return;
    }

    if (data) {
      if (data.is_suspended) {
        alert("账户已被停用 / Account suspended.");
        await supabase.auth.signOut();
        return;
      }
      setUserProfile(data);
      console.log("UserProfile Sync SUCCESS. Role:", data.role);
      // 更新最后登录时间
      await supabase.from('user_profiles').update({ last_login_at: new Date().toISOString() }).eq('id', userId);
    }
  }, []);

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
        alert(lang === 'zh' ? "需要管理员权限，请确保数据库 role 字段已改为 'admin' 并刷新。" : "Admin role required.");
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
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Initializing AMZBot Environment...</p>
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
