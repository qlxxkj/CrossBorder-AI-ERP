import React, { useState, useEffect, useCallback } from 'react';
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<UILanguage>('zh');
  const [listings, setListings] = useState<Listing[]>([]);

  const fetchIdentity = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      // 1. 获取用户档案
      let { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) throw profileErr;

      if (!profile) {
        console.log("No profile found. Initializing new tenant organization...");
        // 创建新组织
        const newOrgId = crypto.randomUUID();
        const { data: newOrg, error: orgErr } = await supabase.from('organizations').insert([{
          id: newOrgId,
          name: `Org_${userId.slice(0, 5)}`,
          owner_id: userId,
          plan_type: 'Free',
          credits_total: 100,
          credits_used: 0
        }]).select().single();

        if (orgErr) throw orgErr;

        // 创建租户管理员档案
        const { data: newProfile, error: insProfileErr } = await supabase.from('user_profiles').insert([{
          id: userId,
          org_id: newOrgId,
          role: 'tenant_admin',
          plan_type: 'Free',
          credits_total: 100,
          credits_used: 0
        }]).select().single();
        
        if (insProfileErr) throw insProfileErr;
        
        profile = newProfile;
        setOrg(newOrg);
      } else {
        // 获取关联组织信息
        if (profile.org_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.org_id)
            .maybeSingle();
          setOrg(orgData);
        }
      }

      setUserProfile(profile);
      
      if (profile?.is_suspended) {
        alert("Account suspended.");
        await supabase.auth.signOut();
        return;
      }
      
      // 只有在成功获取身份后才跳转
      setView(AppView.DASHBOARD);
    } catch (err: any) {
      console.error("Identity verification failed:", err);
      // 如果报错是因为数据库 RLS 限制或表不存在，我们至少应该让 loading 停止
      // 并在控制台打印详细错误，方便调试
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: cur } }) => {
      setSession(cur);
      if (cur) fetchIdentity(cur.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // 只有在 session 真正改变时才触发重新获取
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
    if (tab === 'admin') setView(AppView.ADMIN);
    else if (tab === 'system') setView(AppView.SYSTEM_MGMT);
    else setView(AppView.DASHBOARD);
  };

  const renderContent = () => {
    if (view === AppView.ADMIN && (userProfile?.role === 'super_admin' || userProfile?.role === 'admin')) {
      return <AdminDashboard uiLang={lang} />;
    }
    if (view === AppView.SYSTEM_MGMT && userProfile?.role === 'tenant_admin') {
      return <SystemManagement uiLang={lang} orgId={userProfile.org_id!} />;
    }
    
    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} />;
      case 'listings': 
        return <ListingsManager onSelectListing={() => {}} listings={listings} setListings={setListings} lang={lang} refreshListings={() => {}} />;
      case 'billing': 
        return <BillingCenter uiLang={lang} />;
      default: 
        return <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} />;
    }
  };

  if (loading && session) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verifying Identity...</p>
      <button 
        onClick={() => { setLoading(false); setView(AppView.LANDING); }} 
        className="mt-8 text-[10px] font-bold text-slate-300 hover:text-indigo-500 transition-colors uppercase tracking-widest"
      >
        Cancel and return
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {userProfile && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          lang={lang} 
          userProfile={userProfile}
          onLogout={() => supabase.auth.signOut()}
        />
      )}
      <main className={`${userProfile ? 'ml-64' : 'w-full'} flex-1 h-screen overflow-hidden`}>
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