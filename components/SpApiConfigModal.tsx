import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle2, AlertTriangle, Key, ShieldCheck, RefreshCw, 
  Download, Loader2, ExternalLink, Cpu, Database, Save, Globe
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

export const SpApiConfigModal: React.FC<SpApiConfigModalProps> = ({
  isOpen, onClose, uiLang, onListingsImported
}) => {
  const [config, setConfig] = useState<SpApiConfig>(getStoredSpApiConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredSpApiConfig());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSpApiConnectionProxy(config);
      setTestResult({
        success: true,
        message: res.message || (uiLang === 'zh' ? '连接成功！SP-API 私有应用认证正常。' : 'Connection Successful! SP-API Private App Authorized.')
      });
      saveStoredSpApiConfig(config);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || (uiLang === 'zh' ? '认证失败，请检查 LWA Client ID、Secret 及 Refresh Token' : 'Auth failed. Please check LWA Client ID, Secret and Refresh Token')
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = () => {
    saveStoredSpApiConfig(config);
    alert(uiLang === 'zh' ? 'SP-API 私有应用配置已保存在本地。' : 'SP-API Private App Config saved successfully.');
  };

  const handleImportListings = async () => {
    setIsImporting(true);
    try {
      const res = await importListingsFromSpApiProxy(config);
      if (res.items && onListingsImported) {
        onListingsImported(res.items);
      }
      alert(uiLang === 'zh' 
        ? `成功从亚马逊 SP-API 同步了 ${res.count || res.items.length} 条商品列表！` 
        : `Successfully imported ${res.count || res.items.length} listings from Amazon SP-API!`);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">
                {uiLang === 'zh' ? '亚马逊 SP-API 私有应用对接' : 'Amazon SP-API Private App Integration'}
              </h3>
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-0.5">
                {uiLang === 'zh' ? '自用卖家账号 Self-Authorized Application' : 'Self-Authorized Private Application'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
          
          {/* Note Banner */}
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-wider">
              <AlertTriangle size={16} />
              {uiLang === 'zh' ? '私有化应用（Self-Authorized）配置说明' : 'Private App Authorization Guide'}
            </div>
            <p className="text-xs font-bold text-amber-700 leading-relaxed">
              {uiLang === 'zh' 
                ? '作为自用私有应用，您无需提交公共应用审核。请在亚马逊 Seller Central 开发者控制台（Developer Console）中创建自建应用，并直接使用“Self-Authorization”（自授权）生成的 LWA Refresh Token、LWA Client ID 与 Client Secret。' 
                : 'For private applications, public app authorization is not required. Simply create a self-authorized app in Seller Central Developer Console and input your LWA Refresh Token, Client ID, and Client Secret.'}
            </p>
            <a 
              href="https://developer-docs.amazon.com/sp-api/docs/self-authorization" 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center gap-1.5 text-[11px] font-black text-indigo-600 hover:underline mt-1"
            >
              <span>{uiLang === 'zh' ? '查看亚马逊 SP-API 自授权文档' : 'View Amazon SP-API Self-Auth Docs'}</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Connection Test Result Indicator */}
          {testResult && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
              testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.success ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />}
              <div>
                <p className="font-black text-xs uppercase tracking-wider">{testResult.success ? (uiLang === 'zh' ? '验证通过' : 'Authorized Successfully') : (uiLang === 'zh' ? '验证失败' : 'Auth Failed')}</p>
                <p className="text-xs font-bold mt-1">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-500" /> Seller ID / Merchant ID
              </label>
              <input 
                type="text" 
                value={config.seller_id} 
                onChange={e => setConfig({ ...config, seller_id: e.target.value })} 
                placeholder="A21XXXXXXX..." 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Globe size={14} className="text-blue-500" /> SP-API Region
              </label>
              <select 
                value={config.region} 
                onChange={e => setConfig({ ...config, region: e.target.value as any })}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase outline-none focus:bg-white focus:border-indigo-600"
              >
                <option value="NA">North America (NA - us-east-1)</option>
                <option value="EU">Europe (EU - eu-west-1)</option>
                <option value="FE">Far East (FE - ap-northeast-1)</option>
              </select>
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Key size={14} className="text-amber-500" /> LWA Client ID
              </label>
              <input 
                type="text" 
                value={config.lwa_client_id} 
                onChange={e => setConfig({ ...config, lwa_client_id: e.target.value })} 
                placeholder="amzn1.application-oa2-client.xxxx..." 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Key size={14} className="text-amber-500" /> LWA Client Secret
              </label>
              <input 
                type="password" 
                value={config.lwa_client_secret} 
                onChange={e => setConfig({ ...config, lwa_client_secret: e.target.value })} 
                placeholder="amzn1.oa2-cs.v1.xxxx..." 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Database size={14} className="text-purple-500" /> LWA Refresh Token (Self-Authorized)
              </label>
              <textarea 
                rows={3} 
                value={config.refresh_token} 
                onChange={e => setConfig({ ...config, refresh_token: e.target.value })} 
                placeholder="Atzr|IwEB..." 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none focus:bg-white focus:border-indigo-600 resize-none"
              />
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Marketplace ID</label>
              <input 
                type="text" 
                value={config.marketplace_id} 
                onChange={e => setConfig({ ...config, marketplace_id: e.target.value })} 
                placeholder="ATVPDKIKX0DER (US)" 
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs font-bold outline-none"
              />
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3">
            <button 
              onClick={handleTestConnection} 
              disabled={isTesting}
              className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md"
            >
              {isTesting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              <span>{uiLang === 'zh' ? '测试 SP-API 认证' : 'Test SP-API Auth'}</span>
            </button>

            <button 
              onClick={handleSaveConfig} 
              className="flex items-center gap-2 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-100 transition-all"
            >
              <Save size={16} />
              <span>{uiLang === 'zh' ? '保存配置' : 'Save Config'}</span>
            </button>
          </div>

          <button 
            onClick={handleImportListings} 
            disabled={isImporting}
            className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl shadow-indigo-100"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>{uiLang === 'zh' ? '从亚马逊同步商品' : 'Import Amazon Listings'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
