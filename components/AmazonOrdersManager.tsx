import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, RefreshCw, Filter, Calendar, 
  ExternalLink, Truck, CheckCircle2, Clock, XCircle, 
  ChevronRight, MapPin, Mail, DollarSign, Download, User, X
} from 'lucide-react';
import { AmazonOrder, UILanguage } from '../types';
import { 
  getStoredAmazonOrders, 
  saveStoredAmazonOrders, 
  fetchAmazonOrdersProxy, 
  getStoredSpApiConfig 
} from '../services/spApiService';

interface AmazonOrdersManagerProps {
  uiLang: UILanguage;
  onOpenSettings?: () => void;
}

export const AmazonOrdersManager: React.FC<AmazonOrdersManagerProps> = ({
  uiLang,
  onOpenSettings
}) => {
  const [orders, setOrders] = useState<AmazonOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('ALL');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AmazonOrder | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const isZh = uiLang === 'zh';

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = () => {
    const list = getStoredAmazonOrders();
    setOrders(list);
  };

  const handleSyncOrders = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const config = getStoredSpApiConfig();
      if (!config.lwa_client_id || !config.refresh_token) {
        alert(isZh ? '请先配置 SP-API 凭证（LWA Client ID、Client Secret 及 Refresh Token）' : 'Please configure SP-API credentials first.');
        if (onOpenSettings) onOpenSettings();
        return;
      }

      const res = await fetchAmazonOrdersProxy(config);
      setOrders(getStoredAmazonOrders());
      setSyncNotice(
        isZh 
          ? `成功同步 ${res.count} 个亚马逊订单！` 
          : `Successfully synced ${res.count} Amazon orders!`
      );
      setTimeout(() => setSyncNotice(null), 6000);
    } catch (err: any) {
      alert(err.message || (isZh ? '订单同步失败' : 'Failed to sync orders'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['Order ID', 'Purchase Date', 'Status', 'Fulfillment', 'Marketplace', 'Buyer Name', 'Total Amount', 'Currency', 'Items'];
    const rows = orders.map(o => [
      o.amazon_order_id,
      new Date(o.purchase_date).toLocaleDateString(),
      o.order_status,
      o.fulfillment_channel === 'AFN' ? 'FBA' : 'FBM',
      o.marketplace_id,
      o.buyer_info?.buyer_name || 'Customer',
      o.order_total.amount,
      o.order_total.currency,
      o.order_items?.map(i => `${i.sku}x${i.quantity_ordered}`).join(';') || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `amazon_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.amazon_order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.buyer_info?.buyer_name && o.buyer_info.buyer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.order_items && o.order_items.some(i => i.sku.toLowerCase().includes(searchTerm.toLowerCase()) || i.title.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesStatus = statusFilter === 'ALL' || o.order_status === statusFilter;
    const matchesFulfillment = fulfillmentFilter === 'ALL' || o.fulfillment_channel === fulfillmentFilter;
    const matchesMarketplace = marketplaceFilter === 'ALL' || o.marketplace_id === marketplaceFilter;

    return matchesSearch && matchesStatus && matchesFulfillment && matchesMarketplace;
  });

  const unshippedCount = orders.filter(o => o.order_status === 'Unshipped' || o.order_status === 'PartiallyShipped').length;
  const shippedCount = orders.filter(o => o.order_status === 'Shipped').length;
  const totalSales = orders.reduce((sum, o) => sum + (o.order_total?.amount || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
              <ShoppingBag size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {isZh ? '亚马逊订单管理' : 'Amazon Orders Management'}
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold uppercase">
                  Orders v0
                </span>
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {isZh ? '通过 SP-API 实时同步并管理亚马逊全球站点的订单与发货状态' : 'Sync and track customer orders across Amazon global marketplaces'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={handleExportCSV}
            disabled={orders.length === 0}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={15} /> {isZh ? '导出订单 CSV' : 'Export Orders'}
          </button>

          <button 
            onClick={handleSyncOrders}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? (isZh ? '正在从亚马逊同步...' : 'Syncing...') : (isZh ? '同步亚马逊订单' : 'Sync Orders')}
          </button>
        </div>
      </div>

      {/* Sync Notice Alert */}
      {syncNotice && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600" />
            <span>{syncNotice}</span>
          </div>
          <button onClick={() => setSyncNotice(null)} className="text-blue-600 hover:text-blue-900">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isZh ? '订单总量' : 'Total Orders'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{orders.length}</span>
            <span className="text-xs font-bold text-slate-400">{isZh ? '笔' : 'orders'}</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">{isZh ? '待发货 / 待处理' : 'Unshipped'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600">{unshippedCount}</span>
            <Clock size={18} className="text-amber-500" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{isZh ? '已完成发货' : 'Shipped'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600">{shippedCount}</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{isZh ? '总销售金额 (USD)' : 'Total Revenue'}</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-600">${totalSales.toFixed(2)}</span>
            <DollarSign size={18} className="text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isZh ? "搜索订单号、买家姓名、SKU..." : "Search Order ID, Buyer, SKU..."}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '全部订单状态' : 'All Status'}</option>
            <option value="Unshipped">{isZh ? '待发货 (Unshipped)' : 'Unshipped'}</option>
            <option value="Shipped">{isZh ? '已发货 (Shipped)' : 'Shipped'}</option>
            <option value="Pending">{isZh ? '待付款/审核中 (Pending)' : 'Pending'}</option>
            <option value="Canceled">{isZh ? '已取消 (Canceled)' : 'Canceled'}</option>
          </select>

          <select 
            value={fulfillmentFilter}
            onChange={(e) => setFulfillmentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '全部配送渠道' : 'All Channels'}</option>
            <option value="AFN">FBA (亚马逊配送 - AFN)</option>
            <option value="MFN">FBM (卖家自配送 - MFN)</option>
          </select>

          <select 
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">{isZh ? '所有站点' : 'All Marketplaces'}</option>
            <option value="ATVPDKIKX0DER">🇺🇸 美国 (US)</option>
            <option value="A2EUQ1WTGCTBG2">🇨🇦 加拿大 (CA)</option>
            <option value="A1F83G8C2ARO7P">🇬🇧 英国 (UK)</option>
            <option value="A1PA6795UKMFR9">🇩🇪 德国 (DE)</option>
            <option value="A1VC38T7YXB528">🇯🇵 日本 (JP)</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
              <ShoppingBag size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                {orders.length === 0 
                  ? (isZh ? '暂无亚马逊订单数据' : 'No Orders Found') 
                  : (isZh ? '无符合条件的订单' : 'No matching orders')}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {orders.length === 0 
                  ? (isZh ? '点击右上角【同步亚马逊订单】，系统将通过 SP-API 实时抓取您的店铺最新订单。' : 'Click "Sync Orders" to fetch latest customer purchases.')
                  : (isZh ? '请尝试修改搜索词或重置筛选器。' : 'Try clearing your filters.')}
              </p>
            </div>
            {orders.length === 0 && (
              <div className="flex justify-center pt-2">
                <button 
                  onClick={handleSyncOrders}
                  disabled={isSyncing}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isZh ? '立即同步订单' : 'Sync Orders Now'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-4 px-5">{isZh ? '订单号 / 下单时间' : 'Order ID & Date'}</th>
                  <th className="py-4 px-4">{isZh ? '买家信息' : 'Buyer'}</th>
                  <th className="py-4 px-4">{isZh ? '商品明细' : 'Items'}</th>
                  <th className="py-4 px-4">{isZh ? '订单总额' : 'Total'}</th>
                  <th className="py-4 px-4">{isZh ? '配送模式' : 'Fulfillment'}</th>
                  <th className="py-4 px-4">{isZh ? '订单状态' : 'Status'}</th>
                  <th className="py-4 px-5 text-right">{isZh ? '详情' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                {filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5">
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-slate-900 text-sm flex items-center gap-1">
                          {o.amazon_order_id}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <Clock size={11} />
                          <span>{new Date(o.purchase_date).toLocaleString()}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          <span>{o.buyer_info?.buyer_name || 'Customer'}</span>
                        </div>
                        {o.shipping_address && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1">
                            <MapPin size={11} />
                            <span>{o.shipping_address.city}, {o.shipping_address.state_or_region} ({o.shipping_address.country_code})</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {o.order_items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {item.sku}
                            </span>
                            <span className="text-slate-500">x{item.quantity_ordered}</span>
                          </div>
                        )) || <span className="text-slate-400">{o.number_of_items_shipped + o.number_of_items_unshipped} 件商品</span>}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="font-black text-slate-900 text-sm">
                        ${o.order_total?.amount.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase">
                        {o.order_total?.currency || 'USD'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        o.fulfillment_channel === 'AFN' 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {o.fulfillment_channel === 'AFN' ? 'FBA' : 'FBM'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        o.order_status === 'Shipped' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : o.order_status === 'Unshipped'
                          ? 'bg-amber-50 text-amber-700'
                          : o.order_status === 'Canceled'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {o.order_status}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-right">
                      <button 
                        onClick={() => setSelectedOrder(o)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1"
                      >
                        {isZh ? '查看详情' : 'Details'} <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Amazon Order</span>
                <h3 className="text-lg font-black text-slate-900 font-mono">
                  {selectedOrder.amazon_order_id}
                </h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Order info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 block">{isZh ? '下单时间' : 'Purchase Date'}</span>
                <span className="font-bold text-slate-800">{new Date(selectedOrder.purchase_date).toLocaleDateString()}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 block">{isZh ? '订单状态' : 'Status'}</span>
                <span className="font-bold text-emerald-600">{selectedOrder.order_status}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 block">{isZh ? '配送方式' : 'Fulfillment'}</span>
                <span className="font-bold text-indigo-600">{selectedOrder.fulfillment_channel === 'AFN' ? 'FBA' : 'FBM'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 block">{isZh ? '订单总额' : 'Total'}</span>
                <span className="font-black text-slate-900">${selectedOrder.order_total?.amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Customer & Shipping Details */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-2 text-xs">
              <h4 className="font-black text-slate-900 flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-500" />
                {isZh ? '收件人及配送地址' : 'Recipient & Shipping Address'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 font-medium pt-1">
                <div>
                  <span className="text-slate-400">{isZh ? '买家姓名: ' : 'Buyer: '}</span>
                  <span className="font-bold text-slate-800">{selectedOrder.buyer_info?.buyer_name || 'Customer'}</span>
                </div>
                <div>
                  <span className="text-slate-400">{isZh ? '街道地址: ' : 'Address: '}</span>
                  <span>{selectedOrder.shipping_address?.street || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400">{isZh ? '城市/州/邮编: ' : 'City/State: '}</span>
                  <span>{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state_or_region} {selectedOrder.shipping_address?.postal_code}</span>
                </div>
                <div>
                  <span className="text-slate-400">{isZh ? '国家/地区: ' : 'Country: '}</span>
                  <span className="font-bold">{selectedOrder.shipping_address?.country_code}</span>
                </div>
              </div>
            </div>

            {/* Ordered Items List */}
            <div className="space-y-3">
              <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-blue-500" />
                {isZh ? '订购商品明细' : 'Ordered Items'}
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {selectedOrder.order_items?.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-100 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="w-10 h-10 object-cover rounded-xl border border-slate-200" referrerPolicy="no-referrer" />
                      )}
                      <div>
                        <p className="font-bold text-slate-900 line-clamp-1">{item.title}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                          <span>SKU: {item.sku}</span>
                          {item.asin && <span>ASIN: {item.asin}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-900">${item.item_price?.amount.toFixed(2) || '0.00'}</span>
                      <span className="text-[11px] text-slate-400 block font-bold">Qty: {item.quantity_ordered}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button 
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs"
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
