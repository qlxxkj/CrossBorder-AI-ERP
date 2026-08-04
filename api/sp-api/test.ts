export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const config = await req.json();
    const { lwa_client_id, lwa_client_secret, refresh_token, seller_id, region, marketplace_id } = config;

    if (!lwa_client_id || !lwa_client_secret || !refresh_token) {
      return new Response(JSON.stringify({
        error: 'Missing required credentials: LWA Client ID, LWA Client Secret, and Refresh Token are required.'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Call Amazon LWA endpoint to exchange refresh_token for access_token
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: lwa_client_id,
        client_secret: lwa_client_secret,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return new Response(JSON.stringify({
        success: false,
        error: tokenData.error_description || tokenData.error || 'Amazon LWA Authorization Failed. Please check Client ID, Secret, and Refresh Token.'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const hostMap: Record<string, string> = {
      'NA': 'sellingpartnerapi-na.amazon.com',
      'EU': 'sellingpartnerapi-eu.amazon.com',
      'FE': 'sellingpartnerapi-fe.amazon.com'
    };
    const targetHost = hostMap[region] || 'sellingpartnerapi-na.amazon.com';

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully authenticated Private Application with Amazon SP-API (${region} - ${targetHost})!`,
      seller_id: seller_id || 'Self-Authorized Private Seller',
      access_token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      timestamp: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal Server Error testing SP-API connection'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
