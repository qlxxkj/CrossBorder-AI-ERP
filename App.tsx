
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ListingsManager } from './components/ListingsManager';
import { ListingDetail } from './components/ListingDetail';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
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
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lang, setLang] = useState<UILanguage>('zh');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemSubTab, setSystemSubTab] = useState<'users' | 'roles' | 'org'>('users');

  // 使用 Ref 记录是否已经处理过初始登录跳转，防止切换 Tab 回来重置视图
  const hasInitiallyRedirected = useRef(false);

  const fetchListings = useCallback(async (orgId: string, userId: string) => {
      if (!isSupabaseConfigured() || !orgId || !userId) return;
    setIsSyncing(true);
    try {
        // 自动修复：将该用户下未归属组织的数据（插件采集的）自动归属到当前组织
        supabase
            .from('listings')
            .update({ org_id: orgId })
            .eq('user_id', userId)
            .is('org_id', null)
            .then(({ error }) => {
                if (error) console.warn("Auto-claim background task info:", error);
            });
      // 增加 org_id 过滤，确保多租户隔离
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .or(`org_id.eq.${orgId},user_id.eq.${userId}`)
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

        if (!profile || !profile.org_id) {
            // 检查是否是被邀请的用户（通过邮箱查找且已有组织关联的记录）
          const userEmail = currentSession?.user?.email;
          const { data: invitedProfile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('email', userEmail)
              .not('org_id', 'is', null)
              .maybeSingle();

          if (invitedProfile) {
              // 逻辑：如果是被邀请的用户，继承邀请时的组织和角色
              if (profile) {
                  // 如果触发器已经创建了只有 ID 的档案，则更新它并删除邀请占位符
                  const { data: updatedProfile } = await supabase
                      .from('user_profiles')
                      .update({
                          org_id: invitedProfile.org_id,
                          role: invitedProfile.role,
                          email: userEmail,
                          plan_type: invitedProfile.plan_type || 'Free',
                          credits_total: invitedProfile.credits_total || 0,
                          credits_used: invitedProfile.credits_used || 0
                      })
                      .eq('id', userId)
                      .select()
                      .single();

                  if (invitedProfile.id !== userId) {
                      await supabase.from('user_profiles').delete().eq('id', invitedProfile.id);
                  }
                  profile = updatedProfile;
                }
          } else {
          // 自主注册：创建新组织并设为租户管理员
              // 自主注册逻辑：先检查是否已经创建过组织（防止重复创建）
              let orgIdToUse: string;
              const { data: existingOrg } = await supabase
                  .from('organizations')
                  .select('id')
                  .eq('owner_id', userId)
                  .maybeSingle();

              if (existingOrg) {
                  orgIdToUse = existingOrg.id;
              } else {
                  // 创建新组织并设为租户管理员
                  orgIdToUse = crypto.randomUUID();
                  await supabase.from('organizations').insert([{
                      id: orgIdToUse,
                      name: '',
                      owner_id: userId,
                      plan_type: 'Free',
                      credits_total: 100,
                      credits_used: 0
                  }]);
              }

              // 强制设置角色为 tenant_admin，并关联组织
              const profileData = {
                  org_id: orgIdToUse,
                  role: 'tenant_admin',
                  email: userEmail,
                  plan_type: 'Free',
                  credits_total: 100,
                  credits_used: 0
              };


              if (profile) {
                  // 更新已存在的档案（触发器创建的）
                  const { data: updatedProfile } = await supabase
                      .from('user_profiles')
                      .update(profileData)
                      .eq('id', userId)
                      .select()
                      .single();
                  profile = updatedProfile;
              } else {
                  // 创建全新档案
                  const { data: newProfile } = await supabase
                      .from('user_profiles')
                      .insert([{ id: userId, ...profileData }])
                      .select()
                      .single();
                  profile = newProfile;
              }
          }
      }

      if (profile?.org_id) {
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', profile.org_id).maybeSingle();
        setOrg(orgData);
          fetchListings(profile.org_id, profile.id);

          // 获取角色权限
          if (profile.role === 'tenant_admin' || profile.role === 'super_admin' || profile.role === 'admin') {
              setUserPermissions([]); // 内置管理员在 Sidebar 特殊处理
          } else {
              const { data: roleData } = await supabase
                  .from('roles')
                  .select('permissions')
                  .eq('id', profile.role)
                  .eq('org_id', profile.org_id)
                  .maybeSingle();
              if (roleData) {
                  setUserPermissions(roleData.permissions || []);
              }
          }
      }
      setUserProfile(profile);
    } catch (err) {
      console.error("Identity Sync Error:", err);
    } finally {
      setIsInitializing(false);
    }
  }, [fetchListings]);

  useEffect(() => {
    // 1. 获取初始会话
    supabase.auth.getSession().then(({ data: { session: cur } }) => {
      setSession(cur);
      if (cur) {
        fetchIdentity(cur.user.id, cur);
        // 初始加载有会话，如果是从 Landing/Auth 来的，才跳转
        setView(prev => (prev === AppView.LANDING || prev === AppView.AUTH) ? AppView.DASHBOARD : prev);
      } else {
        setIsInitializing(false);
      }
    });

    // 2. 监听 Auth 变更
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (newSession) {
        fetchIdentity(newSession.user.id, newSession);

        // 关键逻辑：只有在显式 SIGNED_IN 且当前在 Landing/Auth 页面时才重置视图
        if (event === 'SIGNED_IN' && !hasInitiallyRedirected.current) {
          setView(AppView.DASHBOARD);
          setActiveTab('dashboard');
          hasInitiallyRedirected.current = true;
        }
      } else {
        setUserProfile(null);
        setOrg(null);
        setListings([]);
        setView(AppView.LANDING);
        hasInitiallyRedirected.current = false;
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchIdentity]);

  const handleLandingLogin = () => {
    if (session) {
      setView(AppView.DASHBOARD);
    } else {
      setView(AppView.AUTH);
    }
  };

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

  const renderContent = () => {
    if (!userProfile && (view !== AppView.LANDING && view !== AppView.AUTH)) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-white p-20">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Initializing Interface...</p>
        </div>
      );
    }

    try {
      switch(view) {
        case AppView.LISTINGS:
              return <ListingsManager onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }} listings={listings} setListings={setListings} lang={lang} refreshListings={() => userProfile?.org_id && fetchListings(userProfile.org_id, userProfile.id)} isInitialLoading={isSyncing} userProfile={userProfile} />;
        case AppView.LISTING_DETAIL:
          return selectedListing ? (
            <ListingDetail
              listing={selectedListing}
              onBack={() => setView(AppView.LISTINGS)}
              onUpdate={(u) => {
                setListings(prev => prev.map(l => l.id === u.id ? u : l));
                setSelectedListing(u);
              }}
              onDelete={async (id) => {
                await supabase.from('listings').delete().eq('id', id);
                setListings(prev => prev.filter(l => l.id !== id));
                setView(AppView.LISTINGS);
              }}
              onNext={() => {
                const idx = listings.findIndex(l => l.id === selectedListing.id);
                if (idx < listings.length - 1) { setSelectedListing(listings[idx + 1]); }
              }}
              uiLang={lang}
            />
          ) : null;
        case AppView.TEMPLATES: return <TemplateManager uiLang={lang} />;
        case AppView.CATEGORIES: return <CategoryManager uiLang={lang} />;
        case AppView.PRICING: return <PricingManager uiLang={lang} />;
        case AppView.BILLING: return <BillingCenter uiLang={lang} />;
        case AppView.ADMIN: return <AdminDashboard uiLang={lang} />;
          case AppView.SYSTEM_MGMT: return <SystemManagement uiLang={lang} orgId={userProfile?.org_id || ''} orgData={org} currentUserProfile={userProfile} permissions={userPermissions} onOrgUpdate={(newOrg) => setOrg(newOrg)} activeSubTab={systemSubTab} onSubTabChange={setSystemSubTab} />;
        case AppView.DASHBOARD:
        default:
              return <Dashboard listings={listings} lang={lang} userProfile={userProfile} onNavigate={handleTabChange} onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }} isSyncing={isSyncing} onRefresh={() => userProfile?.org_id && fetchListings(userProfile.org_id, userProfile.id)} />;
      }
    } catch (err) {
      console.error("View Crash:", err);
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-4 h-full bg-white">
          <AlertCircle size={48} className="text-red-500" />
          <h3 className="text-xl font-black">Runtime Recovery</h3>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs">Reboot ERP</button>
        </div>
      );
    }
  };

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Initializing Assets...</p>
      </div>
    );
  }

  const showSidebar = userProfile && session && view !== AppView.LANDING && view !== AppView.AUTH;

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden">
      {showSidebar && (
    <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        lang={lang}
        userProfile={userProfile}
        permissions={userPermissions}
        session={session}
        onLogout={() => supabase.auth.signOut()}
        onLogoClick={() => setView(AppView.LANDING)}
    />
    )}
      <main className={`${showSidebar ? 'ml-64' : 'w-full'} flex-1 h-screen overflow-hidden relative transition-all duration-500`}>
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
