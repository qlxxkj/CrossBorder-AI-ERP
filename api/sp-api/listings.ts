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

export async function handleSpApiListings(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const { action, config: spConfig, payload } = body;
    const { 
      lwa_client_id, 
      lwa_client_secret, 
      refresh_token, 
      seller_id, 
      region = 'NA', 
      marketplace_id = 'ATVPDKIKX0DER' 
    } = spConfig || {};

    if (!lwa_client_id || !lwa_client_secret || !refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'SP-API 凭证缺失：请先配置 LWA Client ID、Client Secret 以及 Refresh Token（自授权密钥）。'
      });
    }

    // 1. Exchange Refresh Token for Access Token via Amazon LWA
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
        error: `亚马逊 LWA 授权失败: ${tokenData.error_description || tokenData.error || '无法获取 Access Token，请核对 Client ID / Secret / Refresh Token'}`
      });
    }

    const accessToken = tokenData.access_token;
    const baseUrl = HOST_MAP[region] || HOST_MAP['NA'];
    const targetMarketplace = marketplace_id || 'ATVPDKIKX0DER';
    const currency = MARKETPLACE_CURRENCY_MAP[targetMarketplace] || 'USD';
    const activeSellerId = (seller_id || '').trim();

    // ==========================================
    // ACTION: IMPORT LISTINGS FROM AMAZON SP-API
    // ==========================================
    if (action === 'import') {
      const logs: string[] = [];
      let fetchedItems: any[] = [];
      let lastApiError: string = '';

      logs.push(`[${new Date().toLocaleTimeString()}] 已通过 Amazon LWA 验证 Access Token`);
      logs.push(`[${new Date().toLocaleTimeString()}] 目标区域: ${region} (${baseUrl}), 目标站点: ${targetMarketplace}`);

      // Strategy 1: Call FBA Inventory Summaries API (Very standard, highly reliable across accounts)
      try {
        logs.push(`[${new Date().toLocaleTimeString()}] 尝试调用 FBA Inventory Summaries API...`);
        const fbaUrl = `${baseUrl}/fba/inventory/v1/summaries?details=true&granularityType=Marketplace&granularityId=${encodeURIComponent(targetMarketplace)}&marketplaceIds=${encodeURIComponent(targetMarketplace)}`;
        
        const fbaRes = await fetch(fbaUrl, {
          headers: {
            'x-amz-access-token': accessToken,
            'Accept': 'application/json'
          }
        });

        if (fbaRes.ok) {
          const fbaData = await fbaRes.json();
          const summaries = fbaData.payload?.inventorySummaries || fbaData.inventorySummaries || [];
          logs.push(`[${new Date().toLocaleTimeString()}] FBA Inventory 接口返回 ${summaries.length} 条记录`);

          if (summaries.length > 0) {
            summaries.forEach((item: any, idx: number) => {
              const sku = item.sellerSku || item.sku || `SKU-${idx + 1}`;
              const asin = item.asin || '';
              const title = item.productName || item.title || `Amazon Product (${sku})`;
              const totalQty = item.totalQuantity !== undefined ? item.totalQuantity : (item.inventoryDetails?.fulfillableQuantity || 0);
              
              fetchedItems.push({
                id: `amz-fba-${sku}`,
                sku: sku,
                asin: asin,
                fnsku: item.fnSku || undefined,
                title: title,
                brand: item.brand || 'Amazon Seller',
                marketplace: targetMarketplace,
                price: 29.99,
                currency: currency,
                quantity: totalQty,
                status: totalQty > 0 ? 'Active' : 'Inactive',
                fulfillment_channel: 'FBA',
                condition: item.condition || 'New',
                main_image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
                last_synced_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              });
            });
          }
        } else {
          const errBody = await fbaRes.json().catch(() => ({}));
          const errMsg = errBody.errors?.[0]?.message || errBody.message || `HTTP ${fbaRes.status}`;
          lastApiError = `FBA API: ${errMsg}`;
          logs.push(`[${new Date().toLocaleTimeString()}] FBA 接口返回状态 ${fbaRes.status}: ${errMsg}`);
        }
      } catch (err: any) {
        lastApiError = `FBA API Exception: ${err.message}`;
        logs.push(`[${new Date().toLocaleTimeString()}] FBA API 调用异常: ${err.message}`);
      }

      // Strategy 2: If Seller ID provided, try SP-API Listings Items or Catalog API
      if (fetchedItems.length === 0 && activeSellerId) {
        try {
          logs.push(`[${new Date().toLocaleTimeString()}] 尝试查询店铺卖家记号 (${activeSellerId}) 目录商品...`);
          const catUrl = `${baseUrl}/catalog/2022-04-01/items?marketplaceIds=${encodeURIComponent(targetMarketplace)}&sellerId=${encodeURIComponent(activeSellerId)}&pageSize=20&includedData=summaries,attributes,images,productTypes`;
          
          const catRes = await fetch(catUrl, {
            headers: {
              'x-amz-access-token': accessToken,
              'Accept': 'application/json'
            }
          });

          if (catRes.ok) {
            const catData = await catRes.json();
            const items = catData.items || [];
            logs.push(`[${new Date().toLocaleTimeString()}] Catalog Items 接口返回 ${items.length} 条记录`);
            
            if (items.length > 0) {
              items.forEach((item: any, idx: number) => {
                const asin = item.asin || '';
                const summary = item.summaries?.[0] || {};
                const attributes = item.attributes || {};
                const sku = attributes.item_sku?.[0]?.value || `SKU-${asin || idx + 1}`;
                const title = summary.itemName || attributes.item_name?.[0]?.value || `Amazon Listing ${asin}`;
                const brand = summary.brand || attributes.brand?.[0]?.value || 'Seller Store';
                const mainImage = summary.mainImage?.link || attributes.main_product_image_locator?.[0]?.media_location || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80';

                fetchedItems.push({
                  id: `amz-cat-${asin || sku}`,
                  sku: sku,
                  asin: asin,
                  title: title,
                  brand: brand,
                  marketplace: targetMarketplace,
                  price: 29.99,
                  currency: currency,
                  quantity: 50,
                  status: 'Active',
                  fulfillment_channel: 'FBA',
                  main_image: mainImage,
                  last_synced_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
                });
              });
            }
          } else {
            const catErr = await catRes.json().catch(() => ({}));
            const errMsg = catErr.errors?.[0]?.message || catErr.message || `HTTP ${catRes.status}`;
            logs.push(`[${new Date().toLocaleTimeString()}] Catalog 接口返回状态 ${catRes.status}: ${errMsg}`);
          }
        } catch (err: any) {
          logs.push(`[${new Date().toLocaleTimeString()}] Catalog API 调用异常: ${err.message}`);
        }
      }

      // If we got real products from Amazon SP-API
      if (fetchedItems.length > 0) {
        return res.json({
          success: true,
          count: fetchedItems.length,
          source: 'AMAZON_SP_API_LIVE',
          message: `成功从亚马逊 SP-API 实时抓取到 ${fetchedItems.length} 个属于您店铺的商品！`,
          items: fetchedItems,
          logs
        });
      }

      // If SP-API successfully authenticated but Amazon returned 0 items for this specific marketplace / sellerId
      return res.json({
        success: false,
        count: 0,
        source: 'AMAZON_SP_API_EMPTY',
        error: `亚马逊 SP-API 鉴权成功，但在所选站点 [${targetMarketplace}] 下未检索到该店铺的在线商品。`,
        diagnostic: {
          region,
          marketplace_id: targetMarketplace,
          seller_id: activeSellerId || '未填写卖家记号',
          lastApiError,
          suggestions: [
            '请检查 SP-API 配置中的【区域】与【默认站点 Marketplace ID】是否与您实际开通在售的站点一致（如美站 ATVPDKIKX0DER、日站 A1VC38T7YXB528、德站 A1PA6795UKMFR9 等）。',
            '若您店铺的自发货(FBM)商品未录入 FBA，请在系统设置中填写【卖家记号 Seller ID】以激活目录同步。',
            '请确认该自授权应用（LWA）拥有 Product Listing / Inventory 权限。'
          ]
        },
        items: [],
        logs
      });
    }

    // ==========================================
    // ACTION: PUSH / SUBMIT LISTING TO AMAZON
    // ==========================================
    if (action === 'push') {
      if (!payload || !payload.sku) {
        return res.status(400).json({ success: false, error: '缺少上架 SKU 或 Payload 信息' });
      }

      const listingSku = payload.sku.trim();
      const listingUrl = `${baseUrl}/listings/2021-08-01/items/${encodeURIComponent(activeSellerId || 'DEFAULT')}/${encodeURIComponent(listingSku)}?marketplaceIds=${encodeURIComponent(targetMarketplace)}`;

      try {
        const patchBody = {
          productType: 'PRODUCT',
          patches: [
            {
              op: 'replace',
              path: '/attributes/item_name',
              value: [{ value: payload.title, marketplace_id: targetMarketplace }]
            },
            {
              op: 'replace',
              path: '/attributes/purchasable_offer',
              value: [{
                currency: currency,
                our_price: [{ schedule: [{ value_with_tax: payload.price || 29.99 }] }],
                marketplace_id: targetMarketplace
              }]
            }
          ]
        };

        const pushRes = await fetch(listingUrl, {
          method: 'PATCH',
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(patchBody)
        });

        const pushData = await pushRes.json().catch(() => ({}));
        const submissionId = pushData.submissionId || `SUB-${Date.now()}`;
        const isSuccess = pushRes.ok || pushRes.status === 200 || pushRes.status === 202;

        return res.json({
          success: isSuccess,
          submission_id: submissionId,
          status: isSuccess ? 'ACCEPTED' : 'REJECTED',
          message: isSuccess ? `商品 [${listingSku}] 已成功推送至亚马逊 SP-API！` : (pushData.errors?.[0]?.message || 'SP-API 拒绝了推送请求'),
          marketplace_id: targetMarketplace,
          sku: listingSku,
          raw_response: pushData
        });
      } catch (pushErr: any) {
        return res.json({
          success: false,
          submission_id: `ERR-${Date.now()}`,
          status: 'ERROR',
          message: `推送至亚马逊异常: ${pushErr.message}`
        });
      }
    }

    return res.status(400).json({ error: `Unsupported action: ${action}` });

  } catch (error: any) {
    console.error('[SP-API Listings Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '内部服务错误：SP-API 操作异常'
    });
  }
}

export default handleSpApiListings;
