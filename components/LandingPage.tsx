
import React from 'react';
import { 
  ArrowRight, Bot, Zap, Globe, Download, Sparkles, Check, 
  Database, LayoutDashboard, ShoppingCart, TrendingUp, Bell, User, Image as ImageIcon, Search,
  Cpu, Languages, FileSpreadsheet, Box, Factory, MessageCircle, Github, Twitter, Linkedin
} from 'lucide-react';
import { UILanguage } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from '../lib/i18n';

interface LandingPageProps {
  onLogin: () => void;
  onLogoClick: () => void;
  uiLang: UILanguage;
  onLanguageChange: (lang: UILanguage) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onLogoClick, uiLang, onLanguageChange }) => {
  const t = useTranslation(uiLang);
  
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white overflow-x-hidden selection:bg-blue-100 selection:text-blue-900 scroll-smooth">
      {/* Navbar */}
      <nav className="border-b border-slate-100 fixed w-full bg-white/80 backdrop-blur-md z-[100]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={onLogoClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black">A</div>
            <span className="text-xl font-black text-slate-900">AMZBot ERP</span>
          </button>
          
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
             <button onClick={onLogin} className="px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all">
               {t('getStarted')}
             </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-44 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[600px] bg-gradient-to-br from-blue-100/40 to-purple-100/40 blur-[120px] -z-10 rounded-full"></div>
        
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-xs font-black mb-10 border border-blue-100 uppercase tracking-widest animate-fade-in">
            <Sparkles size={14} className="animate-pulse" /> {uiLang === 'zh' ? 'AI 驱动的跨境电商工作流' : 'AI-Powered Cross-Border Workflow'}
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter mb-10 leading-[0.9] lg:max-w-4xl mx-auto">
            {t('heroTitle')}
          </h1>
          
          <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
            {t('heroSub')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24">
            <button onClick={onLogin} className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-slate-800 shadow-2xl transition-all flex items-center justify-center gap-3">
              {t('getStarted')} <ArrowRight size={22} />
            </button>
            <a 
              href="https://github.com/qlxxkj/amazon-erp-collector/archive/refs/heads/main.zip"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-10 py-5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-black text-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 no-underline shadow-sm"
            >
               <Download size={22} /> {t('installPlugin')}
            </a>
          </div>

          {/* ERP Dashboard Preview */}
          <div className="relative mx-auto max-w-6xl group perspective-1000">
             <div className="absolute -inset-10 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-indigo-600/10 rounded-[4rem] blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="relative rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden aspect-[16/10] flex text-left transform transition-transform duration-700 group-hover:rotate-x-1">
                <div className="w-64 bg-slate-900 flex flex-col p-6 hidden md:flex border-r border-slate-800">
                   <div className="flex items-center gap-3 mb-12">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">AB</div>
                      <span className="text-white font-bold text-lg tracking-tight">AMZBot</span>
                   </div>
                   <div className="space-y-4 flex-1">
                      <div className="h-10 w-full bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/20 flex items-center gap-3 px-4">
                        <LayoutDashboard size={18} /> <div className="h-2 w-1/2 bg-blue-400/30 rounded"></div>
                      </div>
                      {[1,2,3].map(i => (
                        <div key={i} className="h-10 w-full flex items-center gap-3 px-4 opacity-20">
                           <div className="w-5 h-5 bg-slate-700 rounded"></div>
                           <div className="h-2 w-1/2 bg-slate-700 rounded"></div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="flex-1 bg-slate-50 p-10 flex flex-col">
                   <header className="flex justify-between items-center mb-10">
                      <div className="flex gap-4">
                        <div className="h-10 w-56 bg-white border border-slate-100 rounded-xl shadow-sm"></div>
                        <div className="h-10 w-24 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center text-green-600 font-black text-[10px] tracking-widest uppercase animate-pulse">
                           {t('connected')}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-300"><Bell size={18} /></div>
                         <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white"><User size={18} /></div>
                      </div>
                   </header>

                   <div className="grid grid-cols-3 gap-6 mb-10">
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"></div>
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"></div>
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm"></div>
                   </div>

                   <div className="bg-white rounded-[2rem] border border-slate-100 flex-1 p-8 shadow-sm">
                      <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100"></div>
                              <div className="space-y-2">
                                <div className="h-3.5 w-72 bg-slate-50 rounded"></div>
                                <div className="h-2.5 w-32 bg-slate-50/50 rounded"></div>
                              </div>
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

      {/* Features Section */}
      <section id="features" className="py-32 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
             <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">{t('featuresTitle')}</h2>
             <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">{t('featuresSub')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Cpu className="text-blue-600" />} 
              title={t('f1Title')} 
              desc={t('f1Desc')} 
            />
            <FeatureCard 
              icon={<Sparkles className="text-purple-600" />} 
              title={t('f2Title')} 
              desc={t('f2Desc')} 
            />
            <FeatureCard 
              icon={<Languages className="text-indigo-600" />} 
              title={t('f3Title')} 
              desc={t('f3Desc')} 
            />
            <FeatureCard 
              icon={<FileSpreadsheet className="text-emerald-600" />} 
              title={t('f4Title')} 
              desc={t('f4Desc')} 
            />
          </div>
        </div>
      </section>

      {/* Sourcing Section */}
      <section id="sourcing" className="py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 space-y-8">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest border border-orange-100">
                 1688 Visual Search
               </div>
               <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.1]">
                 {t('sourcingTitle')}
               </h2>
               <p className="text-lg text-slate-500 font-medium leading-relaxed">
                 {t('sourcingSub')}
               </p>
               <div className="space-y-6">
                 <div className="flex gap-4">
                   <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0"><ImageIcon size={20}/></div>
                   <p className="text-slate-600 font-medium">{t('s1Desc')}</p>
                 </div>
                 <div className="flex gap-4">
                   <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0"><TrendingUp size={20}/></div>
                   <p className="text-slate-600 font-medium">{t('s2Desc')}</p>
                 </div>
               </div>
            </div>
            <div className="flex-1 relative">
               <div className="absolute -inset-10 bg-orange-500/10 rounded-full blur-[100px]"></div>
               <div className="relative bg-white border border-slate-100 p-8 rounded-[3rem] shadow-2xl grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-square bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden group">
                      <img src={`https://picsum.photos/300/300?random=${i}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                    </div>
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="bg-orange-600 text-white p-6 rounded-3xl shadow-2xl animate-bounce">
                        <Search size={32} />
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how" className="py-32 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
             <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t('howItWorks')}</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-12">
            <StepCard number="01" title={t('step1Title')} desc={t('step1Desc')} />
            <StepCard number="02" title={t('step2Title')} desc={t('step2Desc')} />
            <StepCard number="03" title={t('step3Title')} desc={t('step3Desc')} />
            <StepCard number="04" title={t('step4Title')} desc={t('step4Desc')} />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24">
               <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">{t('pricingTitle')}</h2>
               <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">{t('pricingSub')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
               {/* Starter */}
               <div className="p-12 bg-slate-50 rounded-[3rem] border border-slate-100 flex flex-col items-start text-left">
                  <h4 className="font-black text-slate-400 mb-2 uppercase tracking-widest text-xs">{t('planStarter')}</h4>
                  <div className="text-6xl font-black text-slate-900 mb-10 tracking-tighter">$0</div>
                  <ul className="space-y-5 mb-12 flex-1">
                     <li className="flex gap-4 text-sm text-slate-500 font-bold"><Check size={18} className="text-green-500" /> {t('feature10AI')}</li>
                     <li className="flex gap-4 text-sm text-slate-500 font-bold"><Check size={18} className="text-green-500" /> {t('featureBasicCollect')}</li>
                     <li className="flex gap-4 text-sm text-slate-500 font-bold"><Check size={18} className="text-green-500" /> {t('featureCommunity')}</li>
                  </ul>
                  <button onClick={onLogin} className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all shadow-sm">{t('freeForever')}</button>
               </div>
               
               {/* Growth */}
               <div className="p-12 bg-blue-600 rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(37,99,235,0.4)] relative flex flex-col items-start text-left text-white scale-105 z-10">
                  <div className="absolute top-6 right-10 px-4 py-1.5 bg-white text-blue-600 text-[10px] font-black rounded-full shadow-lg tracking-widest uppercase">Popular Choice</div>
                  <h4 className="font-black text-blue-200 mb-2 uppercase tracking-widest text-xs">{t('planGrowth')}</h4>
                  <div className="text-6xl font-black mb-10 tracking-tighter">$29<span className="text-lg font-normal opacity-60">/mo</span></div>
                  <ul className="space-y-5 mb-12 flex-1">
                     <li className="flex gap-4 text-sm font-bold"><Check size={18} className="text-white" /> {t('featureUnlimited')}</li>
                     <li className="flex gap-4 text-sm font-bold"><Check size={18} className="text-white" /> {t('feature2000Credits')}</li>
                     <li className="flex gap-4 text-sm font-bold"><Check size={18} className="text-white" /> {t('featureFull1688')}</li>
                     <li className="flex gap-4 text-sm font-bold"><Check size={18} className="text-white" /> {t('featureMediaStudio')}</li>
                  </ul>
                  <button onClick={onLogin} className="w-full py-5 bg-white text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all shadow-xl hover:scale-105 active:scale-95">{t('getStarted')}</button>
               </div>

               {/* Elite */}
               <div className="p-12 bg-slate-900 rounded-[3rem] border border-slate-800 flex flex-col items-start text-left text-white">
                  <h4 className="font-black text-slate-500 mb-2 uppercase tracking-widest text-xs">{t('planElite')}</h4>
                  <div className="text-6xl font-black mb-10 tracking-tighter">$79<span className="text-lg font-normal opacity-40">/mo</span></div>
                  <ul className="space-y-5 mb-12 flex-1">
                     <li className="flex gap-4 text-sm text-slate-400 font-bold"><Check size={18} className="text-blue-500" /> {t('featureCollab')}</li>
                     <li className="flex gap-4 text-sm text-slate-400 font-bold"><Check size={18} className="text-blue-500" /> {t('featurePriority')}</li>
                     <li className="flex gap-4 text-sm text-slate-400 font-bold"><Check size={18} className="text-blue-500" /> {t('featureFullAPI')}</li>
                     <li className="flex gap-4 text-sm text-slate-400 font-bold"><Check size={18} className="text-blue-500" /> {t('featureCustomExport')}</li>
                  </ul>
                  <button onClick={onLogin} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black border border-slate-700 hover:bg-slate-700 transition-all">{t('contactSales')}</button>
               </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-24">
            <div className="space-y-6 col-span-1 lg:col-span-1">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">A</div>
                 <span className="text-2xl font-black text-slate-900">AMZBot</span>
               </div>
               <p className="text-slate-500 font-medium leading-relaxed max-w-xs">
                 The intelligent ERP bridge for global Amazon sellers. Powered by next-gen AI.
               </p>
               <div className="flex gap-4">
                 <SocialLink icon={<Github size={20}/>} href="#" />
                 <SocialLink icon={<Twitter size={20}/>} href="#" />
                 <SocialLink icon={<Linkedin size={20}/>} href="#" />
               </div>
            </div>

            <FooterGroup title={t('footerProduct')}>
               <FooterLink href="#features">{t('features')}</FooterLink>
               <FooterLink href="#sourcing">{t('sourcing')}</FooterLink>
               <FooterLink href="#pricing">{t('pricing')}</FooterLink>
               <FooterLink href="#">Chrome Extension</FooterLink>
            </FooterGroup>

            <FooterGroup title={t('footerCompany')}>
               <FooterLink href="#">About Us</FooterLink>
               <FooterLink href="#">Careers</FooterLink>
               <FooterLink href="#">Blog</FooterLink>
               <FooterLink href="#">Media Kit</FooterLink>
            </FooterGroup>

            <FooterGroup title={t('footerSupport')}>
               <FooterLink href="#">Help Center</FooterLink>
               <FooterLink href="#">API Docs</FooterLink>
               <FooterLink href="#">System Status</FooterLink>
               <FooterLink href="#">Community</FooterLink>
            </FooterGroup>
          </div>

          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
             <p className="text-slate-400 text-sm font-medium">
               &copy; {currentYear} AMZBot ERP. {t('allRights')}
             </p>
             <div className="flex gap-8 text-xs font-black text-slate-400 uppercase tracking-widest">
               <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
               <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
               <a href="#" className="hover:text-blue-600 transition-colors">Cookies</a>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: any) => (
  <div className="p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all group">
    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-black text-slate-900 mb-4">{title}</h3>
    <p className="text-slate-500 font-medium leading-relaxed">{desc}</p>
  </div>
);

const StepCard = ({ number, title, desc }: any) => (
  <div className="space-y-6">
    <div className="text-6xl font-black text-white/10 tracking-tighter">{number}</div>
    <h3 className="text-xl font-black">{title}</h3>
    <p className="text-slate-400 font-medium leading-relaxed">{desc}</p>
  </div>
);

const FooterGroup = ({ title, children }: any) => (
  <div className="space-y-6">
    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
    <ul className="space-y-4">
      {children}
    </ul>
  </div>
);

const FooterLink = ({ href, children }: any) => (
  <li>
    <a href={href} className="text-slate-600 font-bold text-sm hover:text-blue-600 transition-colors">
      {children}
    </a>
  </li>
);

const SocialLink = ({ icon, href }: any) => (
  <a href={href} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all">
    {icon}
  </a>
);
