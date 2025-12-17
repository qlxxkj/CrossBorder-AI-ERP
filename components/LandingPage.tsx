import React from 'react';
import { 
  ArrowRight, Bot, Zap, Globe, Download, Sparkles, Check, 
  Database, LayoutDashboard, ShoppingCart, TrendingUp, Bell, User, Image as ImageIcon, Search
} from 'lucide-react';
import { UILanguage } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from '../lib/i18n';

interface LandingPageProps {
  onLogin: () => void;
  uiLang: UILanguage;
  onLanguageChange: (lang: UILanguage) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, uiLang, onLanguageChange }) => {
  const t = useTranslation(uiLang);
  
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="border-b border-slate-100 fixed w-full bg-white/80 backdrop-blur-md z-[100]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black">A</div>
            <span className="text-xl font-black text-slate-900">AMZBot ERP</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-500">
            <a href="#features" className="hover:text-blue-600 transition-colors">{t('features')}</a>
            <a href="#sourcing" className="hover:text-blue-600 transition-colors">{t('sourcing')}</a>
            <a href="#how" className="hover:text-blue-600 transition-colors">{t('howItWorks')}</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">{t('pricing')}</a>
          </div>

          <div className="flex items-center gap-4">
             <LanguageSwitcher currentLang={uiLang} onLanguageChange={onLanguageChange} />
             <button onClick={onLogin} className="text-slate-600 font-bold text-sm hover:text-blue-600 transition-colors">
               {t('signIn')}
             </button>
             <button onClick={onLogin} className="px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-200">
               {t('getStarted')}
             </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[600px] bg-gradient-to-br from-blue-50/50 to-transparent blur-3xl -z-10 rounded-full"></div>
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-xs font-black mb-10 border border-blue-100 uppercase tracking-widest">
            <Sparkles size={14} /> AI-Powered Marketplace Efficiency
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter mb-10 leading-[0.9]">
            {t('heroTitle').split(',')[0]}<br/>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              {t('heroTitle').split(',')[1] || ''}
            </span>
          </h1>
          <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
            {t('heroSub')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24">
            <button onClick={onLogin} className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-slate-800 shadow-2xl transition-all flex items-center gap-3">
              {t('getStarted')} <ArrowRight size={22} />
            </button>
            <button className="w-full sm:w-auto px-10 py-5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-black text-xl hover:bg-slate-50 transition-all flex items-center gap-3">
               <Download size={22} /> {t('installPlugin')}
            </button>
          </div>

          {/* Interactive Mockup UI */}
          <div className="relative mx-auto max-w-6xl group">
             <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="relative rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden aspect-[16/10] flex text-left">
                {/* Simulated Sidebar */}
                <div className="w-64 bg-slate-900 flex flex-col p-6 hidden md:flex border-r border-slate-800">
                   <div className="flex items-center gap-3 mb-12">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">AB</div>
                      <span className="text-white font-bold text-lg tracking-tight">AMZBot ERP</span>
                   </div>
                   <div className="space-y-4">
                      <div className="h-10 w-full bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/20 flex items-center gap-3 px-4">
                        <LayoutDashboard size={18} /> <div className="h-3 w-1/2 bg-blue-400/20 rounded"></div>
                      </div>
                      {[1,2,3].map(i => (
                        <div key={i} className="h-10 w-full flex items-center gap-3 px-4 opacity-30">
                           <div className="w-5 h-5 bg-slate-700 rounded"></div>
                           <div className="h-2 w-1/2 bg-slate-700 rounded"></div>
                        </div>
                      ))}
                   </div>
                   <div className="mt-auto p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                         <div className="flex-1 h-3 bg-slate-700 rounded"></div>
                      </div>
                   </div>
                </div>

                {/* Simulated Main View */}
                <div className="flex-1 bg-slate-50 p-8 flex flex-col">
                   <header className="flex justify-between items-center mb-10">
                      <div className="flex gap-4">
                        <div className="h-10 w-48 bg-white border border-slate-100 rounded-xl shadow-sm"></div>
                        <div className="h-10 w-24 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-xs uppercase tracking-widest">
                           {t('connected')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-300"><Bell size={18} /></div>
                         <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600"><User size={18} /></div>
                      </div>
                   </header>

                   <div className="grid grid-cols-3 gap-6 mb-8">
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                         <div className="h-2 w-12 bg-slate-100 rounded mb-4"></div>
                         <div className="h-8 w-16 bg-slate-900 rounded"></div>
                      </div>
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                         <div className="h-2 w-12 bg-slate-100 rounded mb-4"></div>
                         <div className="h-8 w-16 bg-blue-600 rounded"></div>
                      </div>
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm overflow-hidden relative">
                         <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rotate-45 translate-x-1/2 -translate-y-1/2"></div>
                         <div className="h-2 w-12 bg-slate-100 rounded mb-4"></div>
                         <div className="h-8 w-16 bg-orange-500 rounded"></div>
                      </div>
                   </div>

                   <div className="bg-white rounded-3xl border border-slate-100 flex-1 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                        <div className="h-5 w-40 bg-slate-50 rounded"></div>
                        <div className="h-4 w-12 bg-slate-50 rounded"></div>
                      </div>
                      <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className="w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100"></div>
                              <div className="space-y-2">
                                <div className="h-4 w-64 bg-slate-50 rounded"></div>
                                <div className="h-3 w-32 bg-slate-50/50 rounded"></div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                               <div className="h-8 w-16 bg-indigo-50 border border-indigo-100 rounded-lg"></div>
                               <div className="h-8 w-8 bg-slate-50 rounded-lg"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-slate-50 border-y border-slate-100">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24">
               <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">{t('featuresTitle')}</h2>
               <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">{t('featuresSub')}</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
               {[
                 {
                   icon: <Zap className="text-yellow-500" size={32} />,
                   title: "Speed Collect",
                   desc: "Collection from search results and Best Sellers in < 1s. Extract ASIN, images, and full specs instantly."
                 },
                 {
                   icon: <Bot className="text-blue-600" size={32} />,
                   title: "Dual-Engine AI",
                   desc: "Switch between Gemini 2.5 and GPT-4o. High-conversion titles, bullets, and descriptions tailored for Amazon."
                 },
                 {
                   icon: <Globe className="text-indigo-600" size={32} />,
                   title: "Marketplace Localization",
                   desc: "Translate and localize content for all global Amazon marketplaces with local idioms and cultural nuance."
                 },
                 {
                   icon: <ImageIcon className="text-purple-600" size={32} />,
                   title: "AI Media Studio",
                   desc: "Magic eraser, background removal, and auto-centering for product photos. Drag and drop gallery management."
                 },
                 {
                   icon: <Search className="text-orange-600" size={32} />,
                   title: "1688 Image Sourcing",
                   desc: "One-click factory matching. We find the original source for any Amazon image using proprietary visual search."
                 },
                 {
                   icon: <TrendingUp className="text-emerald-600" size={32} />,
                   title: "Sales Multiplier",
                   desc: "Export ready-to-list CSV templates directly into Amazon Seller Central or your ERP of choice."
                 }
               ].map((f, i) => (
                 <div key={i} className="bg-white p-10 rounded-[2rem] border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all group">
                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">{f.icon}</div>
                    <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight">{f.title}</h3>
                    <p className="text-slate-500 leading-relaxed text-sm font-medium">{f.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Sourcing / Supply Chain Section */}
      <section id="sourcing" className="py-32">
         <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1">
               <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-8"><Search size={28} /></div>
               <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 tracking-tight">Direct Factory Sourcing<br/><span className="text-orange-600">Built-in 1688 Search</span></h2>
               <p className="text-lg text-slate-500 font-medium mb-10 leading-relaxed">
                  Never manually search for suppliers again. Upload your product images or use our extension to instantly reveal matching factory listings on 1688. 
                  Identify the lowest price at the source to maximize your ROI.
               </p>
               <ul className="space-y-4">
                  {['Image-to-Factory Matching', 'Real-time Price Tracking', 'Bulk Sourcing Link Storage'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-900 font-bold">
                       <Check size={20} className="text-orange-500" /> {item}
                    </li>
                  ))}
               </ul>
            </div>
            <div className="flex-1 relative">
               <div className="absolute -inset-10 bg-orange-100/30 rounded-full blur-3xl -z-10"></div>
               <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-4 overflow-hidden">
                  <div className="aspect-square bg-slate-50 rounded-[2rem] flex flex-col items-center justify-center p-8 text-center relative">
                     <div className="absolute top-6 left-6 px-4 py-2 bg-orange-500 text-white text-[10px] font-black rounded-xl">1688 LIVE SEARCH</div>
                     <img src="https://picsum.photos/seed/sourcing/400/400" className="w-32 h-32 rounded-2xl mb-8 shadow-xl" />
                     <div className="h-4 w-48 bg-slate-200 rounded-full mb-4 animate-pulse"></div>
                     <div className="h-3 w-64 bg-slate-100 rounded-full mb-10 animate-pulse"></div>
                     <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="h-20 bg-white border border-slate-100 rounded-2xl shadow-sm"></div>
                        <div className="h-20 bg-white border border-slate-100 rounded-2xl shadow-sm"></div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 bg-slate-900 text-white relative">
         <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[150px] -z-10"></div>
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24">
               <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t('pricingTitle')}</h2>
               <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">{t('pricingSub')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
               <div className="p-10 bg-slate-800/50 rounded-[2.5rem] border border-slate-700/50 flex flex-col">
                  <h4 className="font-bold text-slate-400 mb-4">Starter</h4>
                  <div className="text-5xl font-black mb-8">$0</div>
                  <ul className="space-y-4 mb-12 flex-1">
                     <li className="flex gap-3 text-sm text-slate-400"><Check size={18} className="text-blue-500" /> 10 AI Optimizations / mo</li>
                     <li className="flex gap-3 text-sm text-slate-400"><Check size={18} className="text-blue-500" /> Core Extension Access</li>
                     <li className="flex gap-3 text-sm text-slate-400"><Check size={18} className="text-blue-500" /> Community Support</li>
                  </ul>
                  <button onClick={onLogin} className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black hover:bg-slate-100 transition-colors">Free Forever</button>
               </div>
               
               <div className="p-10 bg-blue-600 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(37,99,235,0.4)] relative flex flex-col">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white text-blue-600 text-[10px] font-black rounded-full shadow-lg tracking-widest uppercase">Most Popular</div>
                  <h4 className="font-bold text-blue-100 mb-4">Pro</h4>
                  <div className="text-5xl font-black mb-8">$29 <span className="text-lg font-normal opacity-60">/mo</span></div>
                  <ul className="space-y-4 mb-12 flex-1">
                     <li className="flex gap-3 text-sm font-bold"><Check size={18} /> Unlimited Extension Collect</li>
                     <li className="flex gap-3 text-sm font-bold"><Check size={18} /> 2,000 AI Credits / mo</li>
                     <li className="flex gap-3 text-sm font-bold"><Check size={18} /> 1688 Visual Search</li>
                     <li className="flex gap-3 text-sm font-bold"><Check size={18} /> AI Image Studio</li>
                  </ul>
                  <button onClick={onLogin} className="w-full py-4 bg-white text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all shadow-xl">Get Growth</button>
               </div>

               <div className="p-10 bg-slate-800/50 rounded-[2.5rem] border border-slate-700/50 flex flex-col">
                  <h4 className="font-bold text-slate-400 mb-4">Elite</h4>
                  <div className="text-5xl font-black mb-8">$79 <span className="text-lg font-normal opacity-40">/mo</span></div>
                  <ul className="space-y-4 mb-12 flex-1">
                     <li className="flex gap-3 text-sm text-slate-400"><Check size={18} className="text-blue-500" /> Team Collaboration (5 seats)</li>
                     <li className="flex gap-3 text-sm text-slate-400"><Check size={18} className="text-blue-500" /> Priority Support</li>
                     <li className="flex gap-3 text-sm text-slate-400"><Check size={18} className="text-blue-500" /> API Access</li>
                  </ul>
                  <button onClick={onLogin} className="w-full py-4 bg-slate-700 border border-slate-600 rounded-2xl font-black hover:bg-slate-600 transition-colors">Contact Sales</button>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-white border-t border-slate-100">
         <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">A</div>
               <span className="font-black text-2xl tracking-tighter text-slate-900 uppercase">AMZBot ERP</span>
            </div>
            <div className="flex gap-10 text-sm font-bold text-slate-400">
               <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
               <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
               <a href="#" className="hover:text-slate-900 transition-colors">Twitter</a>
            </div>
            <div className="text-xs font-black text-slate-300 uppercase tracking-widest">
               &copy; 2025 CrossBorder AI Inc. Powered by Gemini & GPT-4o.
            </div>
         </div>
      </footer>
    </div>
  );
};