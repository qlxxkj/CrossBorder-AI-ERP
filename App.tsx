
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ListingsManager } from './components/ListingsManager';
import { LandingPage } from './components/LandingPage';
import { ListingDetail } from './components/ListingDetail';
import { AuthPage } from './components/AuthPage';
import { TemplateManager } from './components/TemplateManager';
import { AppView, Listing, UILanguage } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<UILanguage>('en');
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    const detectLang = async () => {
      const savedLang = localStorage.getItem('app_lang') as UILanguage;
      if (savedLang) {
        setLang(savedLang);
        return;
      }

      try {
        const browserLang = navigator.language.split('-')[0];
        const supported = ['en', 'zh', 'ja', 'de', 'fr', 'es'];
        if (supported.includes(browserLang)) {
          setLang(browserLang as UILanguage);
        }

        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const country = data.country_code?.toUpperCase();
        
        const geoMap: Record<string, UILanguage> = {
          'CN': 'zh', 'JP': 'ja', 'DE': 'de', 'FR': 'fr', 'ES': 'es',
          'MX': 'es', 'AT': 'de', 'CH': 'de'
        };

        if (country && geoMap[country]) {
          setLang(geoMap[country]);
        }
      } catch (e) {
        console.warn("Language auto-detection via IP failed.");
      }
    };
    detectLang();
  }, []);

  const handleLanguageChange = (newLang: UILanguage) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

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

  const handleNextListing = () => {
    if (!selectedListing || listings.length === 0) return;
    const currentIndex = listings.findIndex(l => l.id === selectedListing.id);
    const nextIndex = (currentIndex + 1) % listings.length;
    setSelectedListing(listings[nextIndex]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogoClick = () => {
    setView(AppView.LANDING);
    setSelectedListing(null);
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
        onLogoClick={handleLogoClick}
        uiLang={lang} 
        onLanguageChange={handleLanguageChange} 
      />
    );
  }

  if (view === AppView.AUTH) return <AuthPage onBack={() => setView(AppView.LANDING)} onLogoClick={handleLogoClick} uiLang={lang} />;

  const renderContent = () => {
    if (view === AppView.LISTING_DETAIL && selectedListing) {
      return (
        <ListingDetail 
          listing={selectedListing} 
          onBack={() => { setView(AppView.DASHBOARD); fetchListings(); }}
          onUpdate={(updated) => {
            setListings(prev => prev.map(l => l.id === updated.id ? updated : l));
            setSelectedListing(updated);
          }}
          onNext={handleNextListing}
          uiLang={lang}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard listings={listings} lang={lang} />;
      case 'listings':
        return (
          <ListingsManager 
            onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }}
            listings={listings}
            setListings={setListings}
            lang={lang}
            refreshListings={fetchListings}
          />
        );
      case 'templates':
        return <TemplateManager uiLang={lang} />;
      case 'settings':
        return <div className="p-10 text-slate-400 font-black uppercase text-xs tracking-widest text-center py-40">System Settings - Restricted Access</div>;
      default:
        return <Dashboard listings={listings} lang={lang} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        onLogout={handleLogout} 
        onLogoClick={handleLogoClick}
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        lang={lang}
      />
      
      <main className="ml-64 flex-1">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
