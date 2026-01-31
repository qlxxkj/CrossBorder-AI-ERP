
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
import { Loader2, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [isInitializing, setIsInitializing] = useState(true); 
  const [lang, setLang] = useState<UILanguage>('zh');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemSubTab, setSystemSubTab] = useState<'users' | 'roles' | 'org'>('users');

  // 监听视图切换，如果是去 LandingPage，允许用户查看
  // 但如果用户从 LandingPage 点击“登录”，我们将检查 session
  const handleLandingLogin = () => {
    if (session) {
      setView(AppView.DASHBOARD);
      setActiveTab('dashboard');
    } else {
      setView(AppView.AUTH);
    }
  };

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
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setListings(data || []);
    } catch (e) {
      console.error("Fetch listings error:", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchIdentity = useCallback(async (userId: string, currentSession: any) => {
    if (!isSupabaseConfigured()) {
      setIsInitializing(false);
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
        const newOrgId = crypto.randomUUID();
        await supabase.from('organizations').insert([{ id: newOrgId, name: `Org_${userId.slice(0, 5)}`, owner_id: userId, plan_type: 'Free', credits_total: 100, credits_used: 0 }]);
        const { data: newProfile } = await supabase.from('user_profiles').insert([{ id: userId, org_id: newOrgId, role: 'tenant_admin', email: currentSession?.user?.email, plan_type: 'Free', credits_total: 100, credits_used: 0 }]).select().single();
        profile = newProfile;
      }

      if (profile?.org_id) {
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', profile.org_id).maybeSingle();
        setOrg(orgData);
        fetchListings(profile.org_id);
      }

      setUserProfile(profile);
      
      // 只有在 AUTH 页面登录成功时，才强制重定向到 Dashboard
      // 如果用户已经在查看 LandingPage，我们不强制跳走，除非他点登录
      if (view === AppView.AUTH) {
        setView(AppView.DASHBOARD);
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error("Identity failure:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [fetchListings, view]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: cur } }) => {
      setSession(cur);
      if (cur) {
        fetchIdentity(cur.user.id, cur);
      } else {
        setIsInitializing(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) {
        fetchIdentity(newSession.user.id, newSession);
      } else {
        setUserProfile(null);
        setOrg(null);
        setListings([]);
        setView(AppView.LANDING);
        setIsInitializing(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchIdentity]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab.startsWith('system:')) {
      const sub = tab.split(':')[1] as any;
      setSystemSubTab(sub); setView(AppView.SYSTEM_MGMT); return;
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

  const handleDeleteListingFromDetail = async (id: string) => {
    if (!isSupabaseConfigured()) return;
    const currentIndex = listings.findIndex(l => l.id === id);
    let nextListingToSelect: Listing | null = null;
    if (currentIndex > -1) {
      if (currentIndex < listings.length - 1) nextListingToSelect = listings[currentIndex + 1];
    }
    try {
      await supabase.from('listings').delete().eq('id', id);
      setListings(prev => prev.filter(l => l.id !== id));
      if (nextListingToSelect) handleSelectListing(nextListingToSelect);
      else {
        setView(AppView.LISTINGS);
        setSelectedListing(null);
      }
    } catch (e) {
      throw e;
    }
  };

  const renderContent = () => {
    try {
      switch(view) {
        case AppView.LISTINGS:
          return <ListingsManager key="list-view-fixed" onSelectListing={handleSelectListing} listings={listings} setListings={setListings} lang={lang} refreshListings={() => userProfile?.org_id && fetchListings(userProfile.org_id)} isInitialLoading={isSyncing} />;
        case AppView.LISTING_DETAIL:
          return selectedListing ? (
            <ListingDetail 
              listing={selectedListing} 
              onBack={() => setView(AppView.LISTINGS)} 
              onUpdate={(u) => { setListings(prev => prev.map(l => l.id === u.id ? u : l)); setSelectedListing(u); }} 
              onDelete={handleDeleteListingFromDetail}
              onNext={() => { 
                const idx = listings.findIndex(l => l.id === selectedListing.id); 
                if (idx < listings.length - 1) handleSelectListing(listings[idx + 1]); 
              }} 
              uiLang={lang} 
            />
          ) : <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} />;
        case AppView.TEMPLATES: return <TemplateManager uiLang={lang} />;
        case AppView.CATEGORIES: return <CategoryManager uiLang={lang} />;
        case AppView.PRICING: return <PricingManager uiLang={lang} />;
        case AppView.BILLING: return <BillingCenter uiLang={lang} />;
        case AppView.ADMIN: return <AdminDashboard uiLang={lang} />;
        case AppView.SYSTEM_MGMT: return <SystemManagement uiLang={lang} orgId={userProfile?.org_id || ''} orgData={org} onOrgUpdate={setOrg} activeSubTab={systemSubTab} onSubTabChange={setSystemSubTab} />;
        case AppView.DASHBOARD:
        default:
          return <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} onSelectListing={handleSelectListing} isSyncing={isSyncing} onRefresh={() => userProfile?.org_id && fetchListings(userProfile.org_id)} />;
      }
    } catch (err) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-4">
          <AlertCircle size={48} className="text-red-500" /><h3 className="text-xl font-black">Framework Load Error</h3>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs">Reload App</button>
        </div>
      );
    }
  };

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initial Booting...</p>
      </div>
    );
  }

  const showSidebar = userProfile && session && view !== AppView.LANDING && view !== AppView.AUTH;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {showSidebar && (
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} lang={lang} userProfile={userProfile} session={session} onLogout={() => supabase.auth.signOut()} onLogoClick={() => setView(AppView.LANDING)} />
      )}
      <main className={`${showSidebar ? 'ml-64' : 'w-full'} flex-1 h-screen overflow-hidden relative`}>
        <div className="h-full overflow-y-auto custom-scrollbar">
          {view === AppView.LANDING ? <LandingPage onLogin={handleLandingLogin} uiLang={lang} onLanguageChange={setLang} onLogoClick={() => setView(AppView.LANDING)} /> :
           view === AppView.AUTH ? <AuthPage onBack={() => setView(AppView.LANDING)} uiLang={lang} onLogoClick={() => setView(AppView.LANDING)} /> :
           renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
