import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Search, Filter, RefreshCw, CheckCircle2, XCircle, 
  Copy, Check, ArrowUpRight, Terminal, AlertTriangle, Trash2
} from 'lucide-react';
import { AmazonFeedLog, UILanguage } from '../types';
import { getStoredFeedLogs } from '../services/spApiService';

interface AmazonFeedLogsViewProps {
  uiLang: UILanguage;
  onNavigateToProducts?: () => void;
}

const MARKETPLACE_NAMES: Record<string, { zh: string; en: string }> = {
  'ATVPDKIKX0DER': { zh: '美国', en: 'United States' },
  'US': { zh: '美国', en: 'United States' },
  'A2EUQ1WTGCTBG2': { zh: '加拿大', en: 'Canada' },
  'CA': { zh: '加拿大', en: 'Canada' },
  'A1AM78C64UM0Y8': { zh: '墨西哥', en: 'Mexico' },
  'MX': { zh: '墨西哥', en: 'Mexico' },
  'A1F83G8C2ARO7P': { zh: '英国', en: 'United Kingdom' },
  'UK': { zh: '英国', en: 'United Kingdom' },
  'GB': { zh: '英国', en: 'United Kingdom' },
  'A1PA6795UKMFR9': { zh: '德国', en: 'Germany' },
  'DE': { zh: '德国', en: 'Germany' },
  'A13V1IB3VIYZZH': { zh: '法国', en: 'France' },
  'FR': { zh: '法国', en: 'France' },
  'APJ6JRA9NG5V4': { zh: '意大利', en: 'Italy' },
  'IT': { zh: '意大利', en: 'Italy' },
  'A1RKKUPIHCS9HS': { zh: '西班牙', en: 'Spain' },
  'ES': { zh: '西班牙', en: 'Spain' },
  'A1VC38T7YXB528': { zh: '日本', en: 'Japan' },
  'JP': { zh: '日本', en: 'Japan' },
  'A39IBJ37TRP1C6': { zh: '澳大利亚', en: 'Australia' },
  'AU': { zh: '澳大利亚', en: 'Australia' }
};

export const AmazonFeedLogsView: React.FC<AmazonFeedLogsViewProps> = ({
  uiLang,
  onNavigateToProducts
}) => {
  const isZh = uiLang === 'zh';
  const [logs, setLogs] = useState<AmazonFeedLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'ERROR'>('ALL');
  const [marketplaceFilter, setMarketplaceFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AmazonFeedLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    const list = getStoredFeedLogs();
    setLogs(list);
  };

  const handleClearLogs = () => {
    if (confirm(isZh ? '确认清空所有上传日志？' : 'Clear all upload logs?')) {
      localStorage.setItem('amzbot_amazon_feed_logs', JSON.stringify([]));
      setLogs([]);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getMarketName = (code?: string) => {
    if (!code) return isZh ? '美国' : 'United States';
    const found = MARKETPLACE_NAMES[code.trim().toUpperCase()];
    if (found) return isZh ? found.zh : found.en;
    return code;
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      const skus = (item.sku_list || []).join(' ');
      const subId = item.submission_id || '';
      const summary = item.response_summary || '';

      const matchesSearch = 
        !searchTerm ||
        subId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skus.toLowerCase().includes(searchTerm.toLowerCase()) ||
        summary.toLowerCase().includes(searchTerm.toLowerCase());

      const isSuccess = item.status === 'ACCEPTED' || item.status === 'DONE';
      const isPending = item.status === 'SUBMITTED' || item.status === 'IN_PROGRESS';
      const isError = item.status === 'FATAL' || item.status === 'ERROR';

      const matchesStatus = 
        statusFilter === 'ALL' || 
        (statusFilter === 'SUCCESS' && isSuccess) ||
        (statusFilter === 'PENDING' && isPending) ||
        (statusFilter === 'ERROR' && isError);

      const matchesMarketplace = 
        marketplaceFilter === 'ALL' || 
        getMarketName(item.marketplace_id) === getMarketName(marketplaceFilter);

      return matchesSearch && matchesStatus && matchesMarketplace;
    });
  }, [logs, searchTerm, statusFilter, marketplaceFilter, isZh]);

  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter(l => l.status === 'ACCEPTED' || l.status === 'DONE').length;
    const error = logs.filter(l => l.status === 'FATAL' || l.status === 'ERROR').length;
    const inProgress = total - success - error;
    return { total, success, error, inProgress };
  }, [logs]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black">
              <Clock size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {isZh ? '上传日志' : 'Upload & Feed Logs'}
              </h1>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {isZh ? '查看向亚马逊 SP-API 发送的商品发布、属性修改及数据推送执行状态' : 'Track and audit Amazon SP-API feeds, updates, and publishing submissions'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={loadLogs}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} />
            {isZh ? '刷新日志' : 'Refresh'}
          </button>

          {logs.length > 0 && (
            <button 
              onClick={handleClearLogs}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Trash2 size={14} />
              {isZh ? '清空记录' : 'Clear Logs'}
            </button>
          )}

          {onNavigateToProducts && (
            <button 
              onClick={onNavigateToProducts}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-xs font-black shadow-lg shadow-amber-200 transition-all flex items-center gap-1.5"
            >
              {isZh ? '进入商品管理' : 'View Products'}
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isZh ? '总提交批次' : 'Total Feeds'}</span>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{isZh ? '成功接受 / 完成' : 'Accepted / Done'}</span>
          <div className="text-2xl font-black text-emerald-600">{stats.success}</div>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">{isZh ? '处理中 / 队列' : 'In Progress'}</span>
          <div className="text-2xl font-black text-amber-600">{stats.inProgress}</div>
        </div>
        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">{isZh ? '错误 / 异常' : 'Failed / Fatal'}</span>
          <div className="text-2xl font-black text-rose-600">{stats.error}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative w-full lg:w-96">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder={isZh ? "搜索提交 ID / SKU / 消息内容..." : "Search Submission ID / SKU / Message..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs">
              <Filter size={13} />
              <span>{isZh ? '状态:' : 'Status:'}</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs focus:outline-none"
            >
              <option value="ALL">{isZh ? '全部状态' : 'All Status'}</option>
              <option value="SUCCESS">{isZh ? '已完成 / 已接受' : 'Success / Accepted'}</option>
              <option value="PENDING">{isZh ? '处理中 / 队列' : 'In Progress'}</option>
              <option value="ERROR">{isZh ? '失败 / 错误' : 'Failed / Error'}</option>
            </select>

            <select
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs focus:outline-none"
            >
              <option value="ALL">{isZh ? '所有站点' : 'All Marketplaces'}</option>
              <option value="US">{isZh ? '美国' : 'United States'}</option>
              <option value="CA">{isZh ? '加拿大' : 'Canada'}</option>
              <option value="MX">{isZh ? '墨西哥' : 'Mexico'}</option>
              <option value="UK">{isZh ? '英国' : 'United Kingdom'}</option>
              <option value="DE">{isZh ? '德国' : 'Germany'}</option>
              <option value="FR">{isZh ? '法国' : 'France'}</option>
              <option value="IT">{isZh ? '意大利' : 'Italy'}</option>
              <option value="ES">{isZh ? '西班牙' : 'Spain'}</option>
              <option value="JP">{isZh ? '日本' : 'Japan'}</option>
              <option value="AU">{isZh ? '澳大利亚' : 'Australia'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-3xl flex items-center justify-center mx-auto">
              <Clock size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-700">
                {isZh ? '暂无上传日志记录' : 'No upload logs found'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {isZh ? '当您在商品管理中点击发布或推送商品至亚马逊 SP-API 时，提交记录将自动在此呈现。' : 'Feeds will appear here when items are published to SP-API.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">{isZh ? '提交 ID (Feed ID)' : 'Submission ID'}</th>
                  <th className="py-4 px-4">{isZh ? '关联商品 SKU' : 'SKU'}</th>
                  <th className="py-4 px-4">{isZh ? '类型' : 'Feed Type'}</th>
                  <th className="py-4 px-4">{isZh ? '目标站点' : 'Marketplace'}</th>
                  <th className="py-4 px-4">{isZh ? '提交时间' : 'Submitted At'}</th>
                  <th className="py-4 px-4">{isZh ? '状态' : 'Status'}</th>
                  <th className="py-4 px-6">{isZh ? '执行结果摘要' : 'Summary'}</th>
                  <th className="py-4 px-6 text-right">{isZh ? '操作' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredLogs.map(item => {
                  const isSuccess = item.status === 'ACCEPTED' || item.status === 'DONE';
                  const isError = item.status === 'FATAL' || item.status === 'ERROR';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2 py-1 rounded-lg text-[11px]">
                            {item.submission_id}
                          </span>
                          <button 
                            onClick={() => handleCopy(item.submission_id, item.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                            title="Copy ID"
                          >
                            {copiedId === item.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(item.sku_list && item.sku_list.length > 0 ? item.sku_list : ['N/A']).map(s => (
                            <span key={s} className="font-mono text-slate-900 font-black bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                          {item.feed_type || 'JSON_LISTINGS_FEED'}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-bold text-[11px]">
                          {getMarketName(item.marketplace_id)}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 w-fit ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : isError 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isSuccess ? <CheckCircle2 size={11} /> : isError ? <XCircle size={11} /> : <Clock size={11} />}
                          {item.status}
                        </span>
                      </td>

                      <td className="py-4 px-6 max-w-xs truncate text-slate-600 text-xs" title={item.response_summary || ''}>
                        {item.response_summary || (isSuccess ? '已成功通过 SP-API 提交至亚马逊' : '处理中...')}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => setSelectedLog(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                        >
                          {isZh ? '查看详情' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 font-black">
                  <Terminal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    {isZh ? '上传日志详情' : 'Upload Submission Details'}
                  </h3>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-0.5 font-mono">
                    ID: {selectedLog.submission_id}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-all">
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-semibold">{isZh ? '关联 SKU 列表' : 'SKUs'}</span>
                  <span className="font-bold text-slate-900 font-mono">{(selectedLog.sku_list || []).join(', ') || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">{isZh ? '目标国家/站点' : 'Marketplace'}</span>
                  <span className="font-bold text-amber-900">{getMarketName(selectedLog.marketplace_id)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">{isZh ? '提交时间' : 'Submitted At'}</span>
                  <span className="font-bold text-slate-700">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">{isZh ? '当前状态' : 'Status'}</span>
                  <span className="font-black text-slate-900">{selectedLog.status}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-black text-slate-700 block mb-1.5">{isZh ? '响应摘要' : 'Response Summary'}</span>
                <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-800 font-medium">
                  {selectedLog.response_summary || (isZh ? 'SP-API 批次已成功排入处理队列' : 'Successfully queued in SP-API')}
                </div>
              </div>

              {selectedLog.error_details && selectedLog.error_details.length > 0 && (
                <div>
                  <span className="text-xs font-black text-rose-700 block mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> {isZh ? '错误与警告日志' : 'Error Details'}
                  </span>
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs space-y-1 font-mono">
                    {selectedLog.error_details.map((err, idx) => (
                      <div key={idx}>• {err}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end bg-slate-50">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
              >
                {isZh ? '关闭' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
