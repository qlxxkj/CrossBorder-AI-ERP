
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ListingsManager } from './components/ListingsManager';
import { LandingPage } from './components/LandingPage';
import { ListingDetail } from './components/ListingDetail';
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
  const viewRef = useRef(view); // 使用 Ref 追踪最新 view
  const [activeTab, setActiveTab] = useState('dashboard');
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<UILanguage>('zh');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => { viewRef.current = view; }, [view]);

  const fetchListings = useCallback(async (orgId: string) => {
    if (!isSupabaseConfigured()) return;
    setIsSyncing(true);
    try {
      const { data } = await supabase.from('listings').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
      if (data) setListings(data);
    } catch (e) {
      console.error("Failed to fetch listings:", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchIdentity = useCallback(async (userId: string) => {
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
        console.log("Legacy user detected. Migrating to RBAC structure...");
        const newOrgId = crypto.randomUUID();
        const { data: newOrg } = await supabase.from('organizations').insert([{
          id: newOrgId,
          name: `Org_${userId.slice(0, 5)}`,
          owner_id: userId,
          plan_type: 'Free',
          credits_total: 100,
          credits_used: 0
        }]).select().single();
        
        const { data: newProfile } = await supabase.from('user_profiles').insert([{
          id: userId,
          org_id: newOrgId,
          role: 'tenant_admin',
          email: session?.user?.email,
          plan_type: 'Free',
          credits_total: 100,
          credits_used: 0
        }]).select().single();
        
        await supabase.from('listings').update({ org_id: newOrgId }).eq('user_id', userId).is('org_id', null);
        profile = newProfile;
        setOrg(newOrg);
      } else if (profile.org_id) {
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', profile.org_id).maybeSingle();
        setOrg(orgData);
      }

      setUserProfile(profile);
      
      if (profile?.is_suspended) {
        alert("Account suspended.");
        await supabase.auth.signOut();
        return;
      }
      
      if (profile?.org_id) {
        await fetchListings(profile.org_id);
      }
      
      // 核心修复：仅当用户处于 Landing/Auth 时才强制切到 Dashboard
      if (viewRef.current === AppView.LANDING || viewRef.current === AppView.AUTH) {
        setView(AppView.DASHBOARD);
      }
    } catch (err: any) {
      console.error("Identity verification failed:", err);
      setView(AppView.AUTH);
    } finally {
      setLoading(false);
    }
  }, [fetchListings, session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: cur } }) => {
      setSession(cur);
      if (cur) fetchIdentity(cur.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession?.user?.id === session?.user?.id && event !== 'SIGNED_IN') return;

      setSession(newSession);
      if (newSession) {
        setLoading(true);
        fetchIdentity(newSession.user.id);
      } else { 
        setView(AppView.LANDING); 
        setUserProfile(null); 
        setOrg(null); 
        setLoading(false);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [fetchIdentity]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch(tab) {
      case 'dashboard': setView(AppView.DASHBOARD); break;
      case 'listings': setView(AppView.DASHBOARD); break;
      case 'templates': setView(AppView.TEMPLATES); break;
      case 'categories': setView(AppView.CATEGORIES); break;
      case 'pricing': setView(AppView.PRICING); break;
      case 'billing': setView(AppView.BILLING); break;
      case 'admin': setView(AppView.ADMIN); break;
      case 'system': setView(AppView.SYSTEM_MGMT); break;
      default: setView(AppView.DASHBOARD);
    }
  };

  const renderContent = () => {
    if (view === AppView.ADMIN && (userProfile?.role === 'super_admin' || userProfile?.role === 'admin')) {
      return <AdminDashboard uiLang={lang} />;
    }
    if (view === AppView.SYSTEM_MGMT && userProfile?.role === 'tenant_admin') {
      return <SystemManagement uiLang={lang} orgId={userProfile.org_id!} orgData={org} onOrgUpdate={setOrg} />;
    }
    
    switch(view) {
      case AppView.TEMPLATES: return <TemplateManager uiLang={lang} />;
      case AppView.CATEGORIES: return <CategoryManager uiLang={lang} />;
      case AppView.PRICING: return <PricingManager uiLang={lang} />;
      case AppView.BILLING: return <BillingCenter uiLang={lang} />;
      default:
        if (activeTab === 'listings') {
          return <ListingsManager 
            onSelectListing={(l) => { /* Selection */ }} 
            listings={listings} 
            setListings={setListings} 
            lang={lang} 
            refreshListings={() => userProfile?.org_id && fetchListings(userProfile.org_id)} 
          />;
        }
        return <Dashboard 
          listings={listings} 
          lang={lang} 
          userProfile={userProfile} 
          onNavigate={handleTabChange} 
          isSyncing={isSyncing}
          onRefresh={() => userProfile?.org_id && fetchListings(userProfile.org_id)}
        />;
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Initializing System...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {userProfile && session && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          lang={lang} 
          userProfile={userProfile}
          session={session}
          onLogout={() => supabase.auth.signOut()}
        />
      )}
      <main className={`${userProfile ? 'ml-64' : 'w-full'} flex-1 h-screen overflow-hidden relative`}>
        <div className="h-full overflow-y-auto custom-scrollbar">
          {view === AppView.LANDING ? <LandingPage onLogin={() => setView(AppView.AUTH)} uiLang={lang} onLanguageChange={setLang} onLogoClick={() => {}} /> :
           view === AppView.AUTH ? <AuthPage onBack={() => setView(AppView.LANDING)} uiLang={lang} onLogoClick={() => {}} /> :
           renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
