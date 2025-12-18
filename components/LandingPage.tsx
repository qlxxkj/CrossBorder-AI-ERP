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
    <div className="min-h-screen bg-white overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
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
             <button onClick={onLogin} className="px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-black hover:bg-blue-700 shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all">
               {t('getStarted')}
             </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-44 pb-24 px-6 relative overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[600px] bg-gradient-to-br from-blue-100/40 to-purple-100/40 blur-[120px] -z-10 rounded-full"></div>
        
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-xs font-black mb-10 border border-blue-100 uppercase tracking-widest animate-fade-in">
            <Sparkles size={14} className="animate-pulse" /> {t('heroTitle').includes('智能') ? 'AI 驱动的跨境电商工作流' : 'AI-Powered Cross-Border Workflow'}
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
            <button className="w-full sm:w-auto px-10 py-5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-black text-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
               <Download size={22} /> {t('installPlugin')}
            </button>
          </div>

          {/* ERP Dashboard Preview */}
          <div className="relative mx-auto max-w-6xl group perspective-1000">
             <div className="absolute -inset-10 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-indigo-600/10 rounded-[4rem] blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="relative rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden aspect-[16/10] flex text-left transform transition-transform duration-700 group-hover:rotate-x-1">
                {/* Mock Sidebar */}
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
                   <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-600"></div>
                         <div className="flex-1 h-2 bg-slate-700 rounded"></div>
                      </div>
                   </div>
                </div>

                {/* Mock Main Content */}
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
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm group-hover:shadow-lg transition-all">
                         <div className="h-2 w-12 bg-slate-100 rounded mb-4"></div>
                         <div className="h-8 w-20 bg-slate-900 rounded"></div>
                      </div>
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm group-hover:shadow-lg transition-all">
                         <div className="h-2 w-12 bg-slate-100 rounded mb-4"></div>
                         <div className="h-8 w-20 bg-blue-600 rounded"></div>
                      </div>
                      <div className="h-32 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm overflow-hidden relative group-hover:shadow-lg transition-all">
                         <div className="h-2 w-12 bg-slate-100 rounded mb-4"></div>
                         <div className="h-8 w-20 bg-orange-500 rounded"></div>
                      </div>
                   </div>

                   <div className="bg-white rounded-[2rem] border border-slate-100 flex-1 p-8 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                        <div className="h-4 w-40 bg-slate-50 rounded"></div>
                        <div className="h-4 w-12 bg-slate-50 rounded"></div>
                      </div>
                      <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                                <ImageIcon size={20} className="text-slate-200" />
                              </div>
                              <div className="space-y-2">
                                <div className="h-3.5 w-72 bg-slate-50 rounded"></div>
                                <div className="h-2.5 w-32 bg-slate-50/50 rounded"></div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                               <div className="h-8 w-20 bg-indigo-50 border border-indigo-100 rounded-xl"></div>
                               <div className="h-8 w-8 bg-slate-50 rounded-xl"></div>
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
      <section id="features" className="py-32 bg-slate-50 border-y border-slate-100">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24">
               <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">{t('featuresTitle')}</h2>
               <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">{t('featuresSub')}</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-10">
               {[
                 {
                   icon: <Zap className="text-yellow-500" size={32} />,
                   title: uiLang === 'zh' ? "极速采集" : "Speed Collect",
                   desc: uiLang === 'zh' ? "毫秒级抓取亚马逊 Best Sellers 榜单及竞品规格。" : "Millisecond-level scraping of Amazon Best Sellers and specs."
                 },
                 {
                   icon: <Bot className="text-blue-600" size={32} />,
                   title: uiLang === 'zh' ? "双引擎 AI" : "Dual-Engine AI",
                   desc: uiLang === 'zh' ? "自由切换 Gemini 2.5 和 GPT-4o，生成高转化标题与详情文案。" : "Toggle between Gemini and GPT-4o for high-conversion copy."
                 },
                 {
                   icon: <Globe className="text-indigo-600" size={32} />,
                   title: uiLang === 'zh' ? "多站点本地化" : "Global Localization",
                   desc: uiLang === 'zh' ? "一键翻译至全球 8 个亚马逊主要站点，适配当地用语习惯。" : "One-click translation for 8 global Amazon marketplaces."
                 },
                 {
                   icon: <ImageIcon className="text-purple-600" size={32} />,
                   title: uiLang === 'zh' ? "AI 媒体实验室" : "AI Media Lab",
                   desc: uiLang === 'zh' ? "智能修图、去背景、自动构图，提升产品图片质感。" : "Magic eraser, background removal, and auto-centering for products."
                 },
                 {
                   icon: <Search className="text-orange-600" size={32} />,
                   title: uiLang === 'zh' ? "1688 货源匹配" : "Visual Sourcing",
                   desc: uiLang === 'zh' ? "独家图像识别技术，一键匹配1688原厂货源，发现更大利润空间。" : "Proprietary visual search to find original factory sources on 1688."
                 },
                 {
                   icon: <TrendingUp className="text-emerald-600" size={32} />,
                   title: uiLang === 'zh' ? "一键导出上架" : "Export & Launch",
                   desc: uiLang === 'zh' ? "符合亚马逊刊登要求的 CSV 模板一键下载，快速实现全平台铺货。" : "Download Amazon-ready CSV templates for rapid marketplace scaling."
                 }
               ].map((f, i) => (
                 <div key={i} className="glass-card p-10 rounded-[2.5rem] border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all group">
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 group-hover:shadow-blue-100 transition-all">{f.icon}</div>
                    <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight">{f.title}</h3>
                    <p className="text-slate-500 leading-relaxed text-sm font-medium">{f.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Sourcing Section */}
      <section id="sourcing" className="py-32 relative overflow-hidden">
         <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 text-left">
               <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mb-8 shadow-inner shadow-orange-200"><Search size={32} /></div>
               <h2 className="text-4xl md:text-6xl font-black text-slate-900 mb-8 tracking-tighter leading-[1.1]">
                 {uiLang === 'zh' ? '告别繁琐手动搜货' : 'Ditch Manual Sourcing'}<br/>
                 <span className="text-orange-600">{uiLang === 'zh' ? '内置 1688 以图搜图' : 'Built-in Visual Search'}</span>
               </h2>
               <p className="text-xl text-slate-500 font-medium mb-10 leading-relaxed">
                  {uiLang === 'zh' 
                    ? '无需多浏览器切换，直接在 ERP 内部调用 1688 深度搜索接口。只需几秒钟，即可发现最有竞争力的源头工厂。'
                    : 'Stop toggling browser tabs. Call the 1688 visual search API directly inside your ERP. Reveal competitive factory sources in seconds.'}
               </p>
               <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: uiLang === 'zh' ? '图像识别率 99%' : '99% Match Rate', icon: <Check className="text-orange-500" /> },
                    { label: uiLang === 'zh' ? '价格对比' : 'Price Comparison', icon: <Check className="text-orange-500" /> },
                    { label: uiLang === 'zh' ? '源头工厂直连' : 'Direct Factory Connect', icon: <Check className="text-orange-500" /> },
                    { label: uiLang === 'zh' ? '批量采集货源' : 'Bulk Sourcing', icon: <Check className="text-orange-500" /> },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                       {item.icon} {item.label}
                    </div>
                  ))}
               </div>
            </div>
            <div className="flex-1 relative">
               <div className="absolute -inset-20 bg-orange-100/40 rounded-full blur-[100px] -z-10"></div>
               <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-6 overflow-hidden transform lg:rotate-3 hover:rotate-0 transition-transform duration-700">
                  <div className="aspect-square bg-slate-50 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center relative border border-slate-100 shadow-inner">
                     <div className="absolute top-8 left-8 px-5 py-2 bg-orange-500 text-white text-[10px] font-black rounded-full shadow-lg tracking-widest uppercase">1688 Visual API</div>
                     <div className="w-40 h-40 bg-white rounded-3xl mb-8 shadow-xl flex items-center justify-center border border-slate-100 relative overflow-hidden group">
                        <img src="https://picsum.photos/seed/sourcing-demo/400/400" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        <div className="absolute inset-0 bg-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     </div>
                     <div className="h-4 w-48 bg-slate-200 rounded-full mb-4 animate-pulse"></div>
                     <div className="h-3 w-64 bg-slate-100 rounded-full mb-12 animate-pulse"></div>
                     <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="h-24 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-center">
                           <div className="h-10 w-20 bg-slate-50 rounded-xl"></div>
                        </div>
                        <div className="h-24 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-center">
                           <div className="h-10 w-20 bg-slate-50 rounded-xl"></div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* How It Works Section */}
      <section id="how" className="py-32 bg-slate-900 text-white relative">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24">
               <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t('howItWorks')}</h2>
               <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">{uiLang === 'zh' ? '仅需四步，完成从灵感到铺货的全流程。' : 'Four simple steps from inspiration to global distribution.'}</p>
            </div>

            <div className="grid md:grid-cols-4 gap-12 relative">
               {/* Connecting Line */}
               <div className="hidden lg:block absolute top-16 left-20 right-20 h-0.5 border-t-2 border-dashed border-slate-800 -z-0"></div>
               
               {[
                 { step: "01", title: t('step1Title'), desc: t('step1Desc') },
                 { step: "02", title: t('step2Title'), desc: t('step2Desc') },
                 { step: "03", title: t('step3Title'), desc: t('step3Desc') },
                 { step: "04", title: t('step4Title'), desc: t('step4Desc') }
               ].map((s, i) => (
                 <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-blue-500 font-black text-xl mb-8 border border-slate-700 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all duration-500 shadow-xl group-hover:shadow-blue-500/50">
                       {s.step}
                    </div>
                    <h3 className="text-xl font-black mb-4 tracking-tight">{s.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed font-medium">{s.desc}</p>
                 </div>
               ))}
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
               {/* Free */}
               <div className="p-12 bg-slate-50 rounded-[3rem] border border-slate-100 flex flex-col items-start text-left">
                  <h4 className="font-black text-slate-400 mb-2 uppercase tracking-widest text-xs">Starter</h4>
                  <div className="text-6xl font-black text-slate-900 mb-10 tracking-tighter">$0</div>
                  <ul className="space-y-5 mb-12 flex-1">
                     {['10 AI Optimizations / mo', 'Basic Collect Tool', 'Community Support'].map((item, i) => (
                       <li key={i} className="flex gap-4 text-sm text-slate-500 font-bold"><Check size={18} className="text-green-500" /> {item}</li>
                     ))}
                  </ul>
                  <button onClick={onLogin} className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all shadow-sm">Free Forever</button>
               </div>
               
               {/* Pro */}
               <div className="p-12 bg-blue-600 rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(37,99,235,0.4)] relative flex flex-col items-start text-left text-white scale-105 z-10">
                  <div className="absolute top-6 right-10 px-4 py-1.5 bg-white text-blue-600 text-[10px] font-black rounded-full shadow-lg tracking-widest uppercase">Popular Choice</div>
                  <h4 className="font-black text-blue-200 mb-2 uppercase tracking-widest text-xs">Growth</h4>
                  <div className="text-6xl font-black mb-10 tracking-tighter">$29<span className="text-lg font-normal opacity-60">/mo</span></div>
                  <ul className="space-y-5 mb-12 flex-1">
                     {[
                       'Unlimited Product Collect', 
                       '2,000 AI Credits / mo', 
                       'Full 1688 Visual API', 
                       'AI Media Studio Pro'
                     ].map((item, i) => (
                       <li key={i} className="flex gap-4 text-sm font-bold"><Check size={18} className="text-white" /> {item}</li>
                     ))}
                  </ul>
                  <button onClick={onLogin} className="w-full py-5 bg-white text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all shadow-xl hover:scale-105 active:scale-95">Get Started</button>
               </div>

               {/* Elite */}
               <div className="p-12 bg-slate-900 rounded-[3rem] border border-slate-800 flex flex-col items-start text-left text-white">
                  <h4 className="font-black text-slate-500 mb-2 uppercase tracking-widest text-xs">Elite</h4>
                  <div className="text-6xl font-black mb-10 tracking-tighter">$79<span className="text-lg font-normal opacity-40">/mo</span></div>
                  <ul className="space-y-5 mb-12 flex-1">
                     {['5 User Collaboration', 'Priority AI Queue', 'Full API Access', 'Custom Exports'].map((item, i) => (
                       <li key={i} className="flex gap-4 text-sm text-slate-400 font-bold"><Check size={18} className="text-blue-500" /> {item}</li>
                     ))}
                  </ul>
                  <button onClick={onLogin} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black border border-slate-700 hover:bg-slate-700 transition-all">Contact Sales</button>
               </div>
            </div>
         </div>
      </section>

      {/* Final CTA */}
      <section className="py-32">
         <div className="max-w-5xl mx-auto px-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[4rem] p-20 text-center text-white relative overflow-hidden shadow-3xl">
               <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-[100px] rounded-full"></div>
               <h2 className="text-5xl font-black mb-8 tracking-tighter">{uiLang === 'zh' ? '准备好开启高效出海了吗？' : 'Ready to dominate globally?'}</h2>
               <p className="text-xl text-blue-100 mb-12 font-medium max-w-xl mx-auto leading-relaxed">
                  {uiLang === 'zh' ? '加入全球数千名跨境大卖家的选择，用 AI 重塑铺货工作流。' : 'Join thousands of successful sellers using AI to reshape their commerce workflow.'}
               </p>
               <button onClick={onLogin} className="px-12 py-5 bg-white text-blue-600 rounded-3xl font-black text-xl hover:bg-blue-50 transition-all shadow-2xl hover:scale-105 active:scale-95">
                  {t('getStarted')}
               </button>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-24 bg-white border-t border-slate-100">
         <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
               <div className="max-w-xs">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">A</div>
                     <span className="font-black text-2xl tracking-tighter text-slate-900 uppercase">AMZBot ERP</span>
                  </div>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                     {uiLang === 'zh' ? '全球领先的 AI 跨境电商 ERP 解决方案，助力铺货卖家一键出海。' : 'Global leader in AI commerce solutions, empowering sellers to scale worldwide.'}
                  </p>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-16">
                  <div className="flex flex-col gap-5">
                     <h5 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Product</h5>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">Features</a>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">Sourcing</a>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">Pricing</a>
                  </div>
                  <div className="flex flex-col gap-5">
                     <h5 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Company</h5>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">About Us</a>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">Blog</a>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">Careers</a>
                  </div>
                  <div className="flex flex-col gap-5">
                     <h5 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Support</h5>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">Help Center</a>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">API Docs</a>
                     <a href="#" className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">Contact</a>
                  </div>
               </div>
            </div>
            <div className="pt-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="text-xs font-black text-slate-300 uppercase tracking-widest">
                  &copy; 2025 CrossBorder AI Inc. Built on Gemini & GPT-4o.
               </div>
               <div className="flex gap-8">
                  <a href="#" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Privacy Policy</a>
                  <a href="#" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Terms of Service</a>
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
};