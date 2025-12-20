
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { ListingDetail } from './components/ListingDetail';
import { AuthPage } from './components/AuthPage';
import { AppView, Listing, UILanguage } from './types';
import { MOCK_CLEANED_DATA } from './constants';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [activeTab, setActiveTab] = useState('listings');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<UILanguage>('en');
  const [listings, setListings] = useState<Listing[]>([]);

  // 1. 智能语言检测逻辑
  useEffect(() => {
    const detectLang = async () => {
      // 优先级1: 用户手动选择过的缓存
      const savedLang = localStorage.getItem('app_lang') as UILanguage;
      if (savedLang) {
        setLang(savedLang);
        return;
      }

      // 优先级2: 基于浏览器语言和 IP 定位
      try {
        // 首先尝试从浏览器语言识别
        const browserLang = navigator.language.split('-')[0];
        const supported = ['en', 'zh', 'ja', 'de', 'fr', 'es'];
        if (supported.includes(browserLang)) {
          setLang(browserLang as UILanguage);
        }

        // 尝试通过 IP 获取地理位置进行更精准的切换
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const country = data.country_code?.toUpperCase();
        
        const geoMap: Record<string, UILanguage> = {
          'CN': 'zh',
          'JP': 'ja',
          'DE': 'de',
          'FR': 'fr',
          'ES': 'es',
          'MX': 'es',
          'AT': 'de',
          'CH': 'de'
        };

        if (country && geoMap[country]) {
          setLang(geoMap[country]);
        }
      } catch (e) {
        console.warn("Language auto-detection via IP failed, using browser defaults.");
      }
    };

    detectLang();
  }, []);

  // 监听语言变化并保存
  const handleLanguageChange = (newLang: UILanguage) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  // 从数据库拉取数据
  const fetchListings = async () => {
    if (!isSupabaseConfigured()) return;
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setListings(data);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setView(AppView.DASHBOARD);
        fetchListings();
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setView(AppView.DASHBOARD);
        fetchListings();
      } else {
        setView(AppView.LANDING);
        setListings([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured()) await supabase.auth.signOut();
    setView(AppView.LANDING);
    setSelectedListing(null);
    setSession(null);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
    </div>
  );

  if (view === AppView.LANDING) {
    return (
      <LandingPage 
        onLogin={() => setView(session ? AppView.DASHBOARD : AppView.AUTH)} 
        uiLang={lang} 
        onLanguageChange={handleLanguageChange} 
      />
    );
  }

  if (view === AppView.AUTH) return <AuthPage onBack={() => setView(AppView.LANDING)} />;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        lang={lang}
      />
      
      <main className="ml-64 flex-1">
        {view === AppView.DASHBOARD && (
          <Dashboard 
            onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }}
            listings={listings}
            setListings={setListings}
            lang={lang}
            refreshListings={fetchListings}
          />
        )}

        {view === AppView.LISTING_DETAIL && selectedListing && (
          <ListingDetail 
            listing={selectedListing} 
            onBack={() => { setView(AppView.DASHBOARD); fetchListings(); }}
            onUpdate={(updated) => {
              setListings(prev => prev.map(l => l.id === updated.id ? updated : l));
              setSelectedListing(updated);
            }}
            uiLang={lang}
          />
        )}
      </main>
    </div>
  );
};

export default App;
