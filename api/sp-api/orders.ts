import type { Request, Response } from 'express';

const HOST_MAP: Record<string, string> = {
  'NA': 'https://sellingpartnerapi-na.amazon.com',
  'EU': 'https://sellingpartnerapi-eu.amazon.com',
  'FE': 'https://sellingpartnerapi-fe.amazon.com'
};

const MARKETPLACE_CURRENCY_MAP: Record<string, string> = {
  'ATVPDKIKX0DER': 'USD', // US
  'A2EUQ1WTGCTBG2': 'CAD', // CA
  'A1AM78C64UM0Y8': 'MXN', // MX
  'A1F83G8C2ARO7P': 'GBP', // UK
  'A1PA6795UKMFR9': 'EUR', // DE
  'A13V1IB3VIYZZH': 'EUR', // FR
  'APJ6JRA9NG5V4': 'EUR',  // IT
  'A1RKKUPIHCS9HS': 'EUR', // ES
  'A1VC38T7YXB528': 'JPY', // JP
  'A39IBJ37TRP1C6': 'AUD', // AU
};

export async function handleSpApiOrders(req: Request, res: Response) {
  try {
    const { config: spConfig, filters } = req.body;
    const { lwa_client_id, lwa_client_secret, refresh_token, region = 'NA', marketplace_id = 'ATVPDKIKX0DER' } = spConfig || {};

    if (!lwa_client_id || !lwa_client_secret || !refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'SP-API 凭证缺失：请先配置 LWA Client ID、Client Secret 及 Refresh Token。'
      });
    }

    // 1. Get LWA token
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token.trim(),
        client_id: lwa_client_id.trim(),
        client_secret: lwa_client_secret.trim(),
      }).toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(401).json({
        success: false,
        error: `亚马逊 LWA 授权失败: ${tokenData.error_description || tokenData.error || '无法获取 Access Token'}`
      });
    }

    const accessToken = tokenData.access_token;
    const baseUrl = HOST_MAP[region] || HOST_MAP['NA'];
    const targetMarketplace = marketplace_id || 'ATVPDKIKX0DER';
    const currency = MARKETPLACE_CURRENCY_MAP[targetMarketplace] || 'USD';

    // 2. Fetch live orders from Amazon Orders v0 API
    let liveOrders: any[] = [];
    const defaultCreatedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const createdAfter = filters?.created_after || defaultCreatedAfter;

    try {
      const ordersUrl = `${baseUrl}/orders/v0/orders?MarketplaceIds=${targetMarketplace}&CreatedAfter=${encodeURIComponent(createdAfter)}`;
      const orderRes = await fetch(ordersUrl, {
        headers: {
          'x-amz-access-token': accessToken,
          'Accept': 'application/json'
        }
      });

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        if (Array.isArray(orderData.payload?.Orders)) {
          liveOrders = orderData.payload.Orders.map((o: any) => ({
            id: `amz-ord-${o.AmazonOrderId}`,
            amazon_order_id: o.AmazonOrderId,
            purchase_date: o.PurchaseDate,
            last_update_date: o.LastUpdateDate,
            order_status: o.OrderStatus,
            fulfillment_channel: o.FulfillmentChannel === 'AFN' ? 'AFN' : 'MFN',
            sales_channel: o.SalesChannel || 'Amazon.com',
            ship_service_level: o.ShipmentServiceLevelCategory || 'Standard',
            order_total: {
              amount: parseFloat(o.OrderTotal?.Amount || '0'),
              currency: o.OrderTotal?.CurrencyCode || currency
            },
            number_of_items_shipped: o.NumberOfItemsShipped || 0,
            number_of_items_unshipped: o.NumberOfItemsUnshipped || 0,
            payment_method: o.PaymentMethod || 'Standard',
            marketplace_id: o.MarketplaceId || targetMarketplace,
            buyer_info: {
              buyer_email: o.BuyerInfo?.BuyerEmail || 'customer@marketplace.amazon.com',
              buyer_name: o.BuyerInfo?.BuyerName || 'Amazon Customer'
            }
          }));
        }
      }
    } catch (orderApiErr) {
      console.warn('Orders API fetch warning:', orderApiErr);
    }

    return res.json({
      success: true,
      count: liveOrders.length,
      orders: liveOrders,
      marketplace_id: targetMarketplace,
      region,
      synced_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[SP-API Orders Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '内部服务错误：无法同步订单'
    });
  }
}

export default handleSpApiOrders;
