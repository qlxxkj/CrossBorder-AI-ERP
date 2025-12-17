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

  const [listings, setListings] = useState<Listing[]>([
    {
      id: 'demo-1',
      asin: 'B004AG7XSM',
      created_at: new Date().toISOString(),
      status: 'collected',
      cleaned: MOCK_CLEANED_DATA
    }
  ]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && view === AppView.LANDING) {
        setView(AppView.DASHBOARD);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setView(AppView.DASHBOARD);
      } else {
        setView(AppView.LANDING);
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
        onLanguageChange={setLang} 
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
        onLanguageChange={setLang}
      />
      
      <main className="ml-64 flex-1">
        {view === AppView.DASHBOARD && (
          <Dashboard 
            onSelectListing={(l) => { setSelectedListing(l); setView(AppView.LISTING_DETAIL); }}
            listings={listings}
            setListings={setListings}
            lang={lang}
          />
        )}

        {view === AppView.LISTING_DETAIL && selectedListing && (
          <ListingDetail 
            listing={selectedListing} 
            onBack={() => setView(AppView.DASHBOARD)}
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