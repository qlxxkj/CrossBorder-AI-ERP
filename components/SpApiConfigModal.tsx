import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, AlertTriangle, Key, ShieldCheck, RefreshCw, 
  Download, Loader2, ExternalLink, Cpu, Database, Save, Globe, Info, Check, HelpCircle
} from 'lucide-react';
import { UILanguage } from '../types';
import { 
  SpApiConfig, getStoredSpApiConfig, saveStoredSpApiConfig, 
  testSpApiConnectionProxy, importListingsFromSpApiProxy 
} from '../services/spApiService';

interface SpApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang: UILanguage;
  onListingsImported?: (items: any[]) => void;
}

const MARKETPLACE_PRESETS = [
  { region: 'NA', code: 'US', name: '美国 (US)', id: 'ATVPDKIKX0DER', flag: '🇺🇸' },
  { region: 'NA', code: 'CA', name: '加拿大 (CA)', id: 'A2EUQ1WTGCTBG2', flag: '🇨🇦' },
  { region: 'NA', code: 'MX', name: '墨西哥 (MX)', id: 'A1AM78C64UM0Y8', flag: '🇲🇽' },
  { region: 'EU', code: 'UK', name: '英国 (UK)', id: 'A1F83G8C2ARO7P', flag: '🇬🇧' },
  { region: 'EU', code: 'DE', name: '德国 (DE)', id: 'A1PA6795UKMFR9', flag: '🇩🇪' },
  { region: 'EU', code: 'FR', name: '法国 (FR)', id: 'A13V1IB3VIYZZH', flag: '🇫🇷' },
  { region: 'EU', code: 'IT', name: '意大利 (IT)', id: 'APJ6JRA9NG5V4', flag: '🇮🇹' },
  { region: 'EU', code: 'ES', name: '西班牙 (ES)', id: 'A1RKKUPIHCS9HS', flag: '🇪🇸' },
  { region: 'FE', code: 'JP', name: '日本 (JP)', id: 'A1VC38T7YXB528', flag: '🇯🇵' },
  { region: 'FE', code: 'AU', name: '澳大利亚 (AU)', id: 'A39IBJ37TRP1C6', flag: '🇦🇺' },
];

export const SpApiConfigModal: React.FC<SpApiConfigModalProps> = ({
  isOpen, onClose, uiLang, onListingsImported
}) => {
  const [config, setConfig] = useState<SpApiConfig>(getStoredSpApiConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showFaq, setShowFaq] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredSpApiConfig());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isZh = uiLang === 'zh';

  const handleApplyPreset = (preset: typeof MARKETPLACE_PRESETS[0]) => {
    setConfig(prev => ({
      ...prev,
      region: preset.region as any,
      marketplace_id: preset.id
    }));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSpApiConnectionProxy(config);
      setTestResult({
        success: true,
        message: res.message || (isZh ? '连接成功！SP-API 私有应用认证正常。' : 'Connection Successful! SP-API Private App Authorized.')
      });
      saveStoredSpApiConfig(config);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || (isZh ? '认证失败，请检查 LWA Client ID、Secret 及 Refresh Token' : 'Auth failed. Please check LWA Client ID, Secret and Refresh Token')
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    saveStoredSpApiConfig(config);
    alert(isZh ? 'SP-API 私有应用配置已保存在本地。' : 'SP-API Private App Config saved successfully.');
  };

  const handleImportListings = async () => {
    setIsImporting(true);
    try {
      const res = await importListingsFromSpApiProxy(config);
      if (res.items && onListingsImported) {
        onListingsImported(res.items);
      }
      alert(isZh 
        ? `成功从亚马逊 SP-API 同步了 ${res.count || res.items?.length || 0} 条商品列表！请在左侧菜单“亚马逊 -> 商品管理”中查看。` 
        : `Successfully imported ${res.count || res.items?.length || 0} listings from Amazon SP-API! View them in Amazon -> Listings.`);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-950 font-black shadow-lg">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">
                {isZh ? '亚马逊 SP-API 私有应用对接 & 站点配置' : 'Amazon SP-API Private App & Marketplace Settings'}
              </h3>
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-0.5">
                {isZh ? '自用卖家账号 Self-Authorized Application' : 'Self-Authorized Private Application'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* Note Banner */}
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                <AlertTriangle size={16} className="text-amber-600" />
                {isZh ? '私有应用（Self-Authorized）快速指南' : 'Private App Authorization Guide'}
              </div>
              <button 
                onClick={() => setShowFaq(!showFaq)}
                className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle size={14} />
                {isZh ? (showFaq ? '收起多站点帮助' : '查看全球多站点配置说明') : (showFaq ? 'Hide FAQ' : 'Global Marketplace Guide')}
              </button>
            </div>
            <p className="text-xs font-bold text-amber-800 leading-relaxed">
              {isZh 
                ? '作为自用 ERP 系统，您无需提交繁琐的公开应用审核。在亚马逊 Seller Central 开发者控制台中创建应用并点击“Self-Authorization”（自授权），即可获取 LWA Refresh Token、LWA Client ID 与 Client Secret。' 
                : 'For private ERP usage, public app review is not required. In Seller Central Developer Console, create a private app and click "Self-Authorization" to obtain your Refresh Token, Client ID, and Client Secret.'}
            </p>
          </div>

          {/* Global Multi-Marketplace Guide Collapsible */}
          {showFaq && (
            <div className="bg-slate-900 text-slate-200 p-6 rounded-2xl space-y-4 text-xs animate-in slide-in-from-top-2">
              <h4 className="font-black text-amber-400 text-sm flex items-center gap-2">
                <Info size={16} /> {isZh ? '全球多站点配置常见问题解答' : 'Global Marketplace Configuration FAQ'}
              </h4>
              <div className="space-y-3 font-medium text-slate-300 leading-relaxed">
                <div>
                  <span className="font-bold text-white block">1. AMAZON_SP_SELLER_ID 是不是卖家记号？</span>
                  <span>是的。Seller ID 即“卖家记号”（Merchant Token / ID）。在亚马逊卖家后台右上角：设置 → 账户信息 → 业务信息 → 卖家记号 中查看，通常形如 <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">A21XXXXXXX</code>。</span>
                </div>
                <div>
                  <span className="font-bold text-white block">2. AMAZON_SP_REGION 怎么填写？</span>
                  <span>填写 SP-API 大区代码：
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
                      <li><strong className="text-white">NA (北美区)</strong>: 包含美国 (US)、加拿大 (CA)、墨西哥 (MX)、巴西 (BR)</li>
                      <li><strong className="text-white">EU (欧洲及中东区)</strong>: 包含英国 (UK)、德国 (DE)、法国 (FR)、意大利 (IT)、西班牙 (ES)、荷兰 (NL)、波兰 (PL)、瑞典 (SE)、阿联酋 (AE)、沙特 (SA) 等</li>
                      <li><strong className="text-white">FE (远东/亚太区)</strong>: 包含日本 (JP)、澳大利亚 (AU)、新加坡 (SG) 等</li>
                    </ul>
                  </span>
                </div>
                <div>
                  <span className="font-bold text-white block">3. 全球多个站点怎么配置？</span>
                  <span>
                    • <strong className="text-white">同一大区（如北美 3 站 / 欧洲多国）</strong>：在统一账号下，<code className="text-amber-300">Seller ID</code> 与 <code className="text-amber-300">LWA Refresh Token</code> 是通用的。您只需在下方选择或切换对应的 Marketplace ID 即可；在发布商品时也可以一键指定站点。<br/>
                    • <strong className="text-white">跨大区账号（如同时拥有北美站和欧洲站）</strong>：北美和欧洲通常在卖家后台分别生成各自大区的自授权 Refresh Token。您可以在此随时切换保存，或者通过环境变量分别配置。
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Preset Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
              <span>{isZh ? '常用站点一键预设 (自动填充 Region & Marketplace ID)' : 'Quick Marketplace Presets'}</span>
              <span className="text-indigo-600 font-bold">{config.region} - {config.marketplace_id}</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACE_PRESETS.map(p => {
                const isSelected = config.marketplace_id === p.id;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      isSelected 
                        ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm font-black' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{p.flag}</span>
                    <span>{p.name}</span>
                    {isSelected && <Check size={12} className="stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection Test Result Indicator */}
          {testResult && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in ${
              testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.success ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />}
              <div>
                <p className="font-black text-xs uppercase tracking-wider">{testResult.success ? (isZh ? '验证通过' : 'Authorized Successfully') : (isZh ? '验证失败' : 'Auth Failed')}</p>
                <p className="text-xs font-bold mt-1">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-500" /> 
                <span>Seller ID (卖家记号 / Merchant ID)</span>
              </label>
              <input 
                type="text" 
                value={config.seller_id} 
                onChange={e => setConfig({ ...config, seller_id: e.target.value.trim() })} 
                placeholder="A21XXXXXXX..." 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600"
              />
              <p className="text-[10px] text-slate-400">可在亚马逊卖家平台“账户信息 → 业务信息 → 卖家记号”中获取</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Globe size={14} className="text-blue-500" /> 
                <span>SP-API Region (大区代码)</span>
              </label>
              <select 
                value={config.region} 
                onChange={e => setConfig({ ...config, region: e.target.value as any })}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase outline-none focus:bg-white focus:border-indigo-600 cursor-pointer"
              >
                <option value="NA">North America (NA - 北美区 us-east-1: US, CA, MX, BR)</option>
                <option value="EU">Europe (EU - 欧洲/中东区 eu-west-1: UK, DE, FR, IT, ES, NL, PL, SE, AE, SA)</option>
                <option value="FE">Far East (FE - 远东/亚太区 ap-northeast-1: JP, AU, SG)</option>
              </select>
              <p className="text-[10px] text-slate-400">选择该站点所在的 SP-API 终结点区域</p>
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Key size={14} className="text-amber-500" /> 
                <span>LWA Client ID (应用客户端 ID)</span>
              </label>
              <input 
                type="text" 
                value={config.lwa_client_id} 
                onChange={e => setConfig({ ...config, lwa_client_id: e.target.value.trim() })} 
                placeholder="amzn1.application-oa2-client.xxxx..." 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Key size={14} className="text-amber-500" /> 
                <span>LWA Client Secret (客户端密码)</span>
              </label>
              <input 
                type="password" 
                value={config.lwa_client_secret} 
                onChange={e => setConfig({ ...config, lwa_client_secret: e.target.value.trim() })} 
                placeholder="amzn1.oa2-cs.v1.xxxx..." 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Database size={14} className="text-purple-500" /> 
                <span>LWA Refresh Token (自授权刷新令牌)</span>
              </label>
              <textarea 
                rows={3} 
                value={config.refresh_token} 
                onChange={e => setConfig({ ...config, refresh_token: e.target.value.trim() })} 
                placeholder="Atzr|IwEB..." 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600 resize-none"
              />
              <p className="text-[10px] text-slate-400">在开发者控制台自建应用点击“Self-Authorization”生成的永久 Refresh Token</p>
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <span>Default Marketplace ID (默认站点 ID)</span>
              </label>
              <input 
                type="text" 
                value={config.marketplace_id} 
                onChange={e => setConfig({ ...config, marketplace_id: e.target.value.trim() })} 
                placeholder="ATVPDKIKX0DER" 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600"
              />
              <p className="text-[10px] text-slate-400">例如：美国 ATVPDKIKX0DER，英国 A1F83G8C2ARO7P，日本 A1VC38T7YXB528</p>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3">
            <button 
              onClick={handleTestConnection} 
              disabled={isTesting}
              className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md cursor-pointer"
            >
              {isTesting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              <span>{isZh ? '测试 SP-API 认证' : 'Test SP-API Auth'}</span>
            </button>

            <button 
              onClick={handleSaveConfig} 
              className="flex items-center gap-2 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-100 transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>{isZh ? '保存配置' : 'Save Config'}</span>
            </button>
          </div>

          <button 
            onClick={handleImportListings} 
            disabled={isImporting}
            className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl shadow-indigo-100 cursor-pointer"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>{isZh ? '从亚马逊同步商品' : 'Import Amazon Listings'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

