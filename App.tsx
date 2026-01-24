
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ListingsManager } from './components/ListingsManager';
import { ListingDetail } from './components/ListingDetail';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage.tsx';
import { TemplateManager } from './components/TemplateManager';
import { CategoryManager } from './components/CategoryManager';
import { PricingManager } from './components/PricingManager';
import { BillingCenter } from './components/BillingCenter';
import { AdminDashboard } from './components/AdminDashboard';
import { SystemManagement } from './components/SystemManagement';
import { AppView, Listing, UILanguage, UserProfile, Organization } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true); // 仅用于初始身份校验
  const [lang, setLang] = useState<UILanguage>('zh');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemSubTab, setSystemSubTab] = useState<'users' | 'roles' | 'org'>('users');

  const viewRef = useRef(view);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => { viewRef.current = view; }, [view]);

  const fetchListings = useCallback(async (orgId: string) => {
    if (!isSupabaseConfigured() || !orgId) {
      setIsSyncing(false);
      return;
    }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase RLS or Query Error:", error.message);
        throw error;
      }
      setListings(data || []);
    } catch (e) {
      console.error("Fetch listings failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchIdentity = useCallback(async (userId: string, currentSession: any) => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      let { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) throw profileErr;

      if (!profile) {
        // 新用户初始化逻辑
        const newOrgId = crypto.randomUUID();
        await supabase.from('organizations').insert([{
          id: newOrgId,
          name: `Org_${userId.slice(0, 5)}`,
          owner_id: userId,
          plan_type: 'Free',
          credits_total: 100,
          credits_used: 0
        }]);
        
        const { data: newProfile } = await supabase.from('user_profiles').insert([{
          id: userId,
          org_id: newOrgId,
          role: 'tenant_admin',
          email: currentSession?.user?.email,
          plan_type: 'Free',
          credits_total: 100,
          credits_used: 0
        }]).select().single();
        
        profile = newProfile;
      }

      if (profile?.org_id) {
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', profile.org_id).maybeSingle();
        setOrg(orgData);
        fetchListings(profile.org_id);
      }

      setUserProfile(profile);

      // 仅在初始进入时重定向到 Dashboard
      if (viewRef.current === AppView.LANDING || viewRef.current === AppView.AUTH) {
        setView(AppView.DASHBOARD);
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error("Identity error:", err);
      setView(AppView.AUTH);
    } finally {
      setLoading(false);
    }
  }, [fetchListings]);

  useEffect(() => {
    // 初始 Session 获取
    supabase.auth.getSession().then(({ data: { session: cur } }) => {
      setSession(cur);
      if (cur) {
        sessionRef.current = cur.user.id;
        fetchIdentity(cur.user.id, cur);
      } else {
        setLoading(false);
      }
    });

    // 监听 Auth 变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!newSession) {
        setSession(null);
        setUserProfile(null);
        setOrg(null);
        setListings([]);
        setView(AppView.LANDING);
        setLoading(false);
        sessionRef.current = null;
        return;
      }

      if (newSession.user.id === sessionRef.current) {
        setSession(newSession);
        return;
      }

      sessionRef.current = newSession.user.id;
      setSession(newSession);
      // 注意：这里不再轻易设置 setLoading(true)，除非用户 ID 真的变了
      fetchIdentity(newSession.user.id, newSession);
    });
    
    return () => subscription.unsubscribe();
  }, [fetchIdentity]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // 移除系统子页面的特殊逻辑，统一由 renderContent 根据 tab 决定内容
    if (tab.startsWith('system:')) {
      const sub = tab.split(':')[1] as any;
      setSystemSubTab(sub);
      setView(AppView.SYSTEM_MGMT);
      return;
    }

    switch(tab) {
      case 'dashboard': setView(AppView.DASHBOARD); break;
      case 'listings': setView(AppView.LISTINGS); break;
      case 'templates': setView(AppView.TEMPLATES); break;
      case 'categories': setView(AppView.CATEGORIES); break;
      case 'pricing': setView(AppView.PRICING); break;
      case 'billing': setView(AppView.BILLING); break;
      case 'admin': setView(AppView.ADMIN); break;
      case 'system': setView(AppView.SYSTEM_MGMT); break;
      default: setView(AppView.DASHBOARD);
    }
  };

  const handleSelectListing = (listing: Listing) => {
    setSelectedListing(listing);
    setView(AppView.LISTING_DETAIL);
  };

  const handleLandingLoginClick = () => {
    if (session && userProfile) {
      setView(AppView.DASHBOARD);
      setActiveTab('dashboard');
    } else {
      setView(AppView.AUTH);
    }
  };

  const renderContent = () => {
    // 权限校验拦截
    if (view === AppView.ADMIN && !(userProfile?.role === 'super_admin' || userProfile?.role === 'admin')) {
      return <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} />;
    }

    switch(view) {
      case AppView.LISTINGS:
        return (
          <ListingsManager 
            key="listings-view-comp" // 使用 Key 强制重绘，防止状态残留
            onSelectListing={handleSelectListing} 
            listings={listings} 
            setListings={setListings} 
            lang={lang} 
            refreshListings={() => userProfile?.org_id && fetchListings(userProfile.org_id)} 
            isInitialLoading={isSyncing} 
          />
        );
      case AppView.LISTING_DETAIL:
        return selectedListing ? (
          <ListingDetail 
            listing={selectedListing} 
            onBack={() => setView(AppView.LISTINGS)} 
            onUpdate={(u) => { 
              setListings(prev => prev.map(l => l.id === u.id ? u : l)); 
              setSelectedListing(u); 
            }}
            onNext={() => {
              const idx = listings.findIndex(l => l.id === selectedListing.id);
              if (idx < listings.length - 1) handleSelectListing(listings[idx + 1]);
            }}
            uiLang={lang} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-slate-300" size={32} />
          </div>
        );
      case AppView.TEMPLATES: return <TemplateManager uiLang={lang} />;
      case AppView.CATEGORIES: return <CategoryManager uiLang={lang} />;
      case AppView.PRICING: return <PricingManager uiLang={lang} />;
      case AppView.BILLING: return <BillingCenter uiLang={lang} />;
      case AppView.ADMIN: return <AdminDashboard uiLang={lang} />;
      case AppView.SYSTEM_MGMT: return <SystemManagement uiLang={lang} orgId={userProfile?.org_id || ''} orgData={org} onOrgUpdate={setOrg} activeSubTab={systemSubTab} onSubTabChange={setSystemSubTab} />;
      case AppView.DASHBOARD:
      default:
        return (
          <Dashboard 
            listings={listings} 
            lang={lang} 
            userProfile={userProfile} 
            onNavigate={handleTabChange} 
            onSelectListing={handleSelectListing} 
            isSyncing={isSyncing} 
            onRefresh={() => userProfile?.org_id && fetchListings(userProfile.org_id)} 
          />
        );
    }
  };

  // 全屏加载仅在初始挂载或认证中显示
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-pulse"></div>
          <Loader2 className="absolute inset-0 m-auto animate-spin text-indigo-600" size={32} />
        </div>
        <div className="flex flex-col items-center gap-1">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Authenticating Session</p>
        </div>
      </div>
    );
  }

  const showSidebar = userProfile && session && view !== AppView.LANDING && view !== AppView.AUTH;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {showSidebar && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          lang={lang} 
          userProfile={userProfile} 
          session={session} 
          onLogout={() => supabase.auth.signOut()} 
          onLogoClick={() => setView(AppView.LANDING)} 
        />
      )}
      <main className={`${showSidebar ? 'ml-64' : 'w-full'} flex-1 h-screen overflow-hidden relative`}>
        <div className="h-full overflow-y-auto custom-scrollbar">
          {view === AppView.LANDING ? (
            <LandingPage onLogin={handleLandingLoginClick} uiLang={lang} onLanguageChange={setLang} onLogoClick={() => setView(AppView.LANDING)} />
          ) : view === AppView.AUTH ? (
            <AuthPage onBack={() => setView(AppView.LANDING)} uiLang={lang} onLogoClick={() => setView(AppView.LANDING)} />
          ) : (
            renderContent()
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
