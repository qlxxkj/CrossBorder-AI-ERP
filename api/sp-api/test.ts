import type { Request, Response } from 'express';

export async function handleSpApiTest(req: Request, res: Response) {
  try {
    const config = req.body;
    const { lwa_client_id, lwa_client_secret, refresh_token, seller_id, region = 'NA', marketplace_id } = config || {};

    if (!lwa_client_id || !lwa_client_secret || !refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'SP-API 凭证缺失：请先填写 LWA Client ID、Client Secret 及 Refresh Token。'
      });
    }

    // Call Amazon LWA endpoint to exchange refresh_token for access_token
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
      return res.status(400).json({
        success: false,
        error: tokenData.error_description || tokenData.error || '亚马逊 LWA 授权失败，请核对 Client ID / Secret / Refresh Token 是否匹配。'
      });
    }

    const hostMap: Record<string, string> = {
      'NA': 'sellingpartnerapi-na.amazon.com',
      'EU': 'sellingpartnerapi-eu.amazon.com',
      'FE': 'sellingpartnerapi-fe.amazon.com'
    };
    const targetHost = hostMap[region] || 'sellingpartnerapi-na.amazon.com';

    return res.json({
      success: true,
      message: `成功通过亚马逊 LWA 鉴权验证！(${region} 节点 - ${targetHost})`,
      seller_id: seller_id || '自授权店铺',
      access_token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[SP-API Test Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '内部服务错误：无法完成 SP-API 鉴权测试'
    });
  }
}

export default handleSpApiTest;
