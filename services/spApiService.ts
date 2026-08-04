export interface SpApiConfig {
  seller_id: string;
  lwa_client_id: string;
  lwa_client_secret: string;
  refresh_token: string;
  region: 'NA' | 'EU' | 'FE'; // NA: North America (us-east-1), EU: Europe (eu-west-1), FE: Far East (ap-northeast-1)
  marketplace_id: string; // e.g. ATVPDKIKX0DER for US
  app_type: 'private'; // Private Self-Authorized Application
  updated_at?: string;
}

export interface SpApiListingPayload {
  sku: string;
  asin?: string;
  marketplace_id?: string;
  title: string;
  brand?: string;
  price?: number;
  bullet_points?: string[];
  description?: string;
}

const SP_API_STORAGE_KEY = 'amzbot_sp_api_config';

export const getStoredSpApiConfig = (): SpApiConfig => {
  try {
    const raw = localStorage.getItem(SP_API_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local SP-API config', e);
  }
  return {
    seller_id: process.env.AMAZON_SP_SELLER_ID || '',
    lwa_client_id: process.env.AMAZON_SP_LWA_CLIENT_ID || '',
    lwa_client_secret: process.env.AMAZON_SP_LWA_CLIENT_SECRET || '',
    refresh_token: process.env.AMAZON_SP_REFRESH_TOKEN || '',
    region: (process.env.AMAZON_SP_REGION as any) || 'NA',
    marketplace_id: process.env.AMAZON_SP_MARKETPLACE_ID || 'ATVPDKIKX0DER',
    app_type: 'private'
  };
};

export const saveStoredSpApiConfig = (config: SpApiConfig): void => {
  localStorage.setItem(SP_API_STORAGE_KEY, JSON.stringify({
    ...config,
    updated_at: new Date().toISOString()
  }));
};

export const testSpApiConnectionProxy = async (config: SpApiConfig): Promise<{ success: boolean; message: string; access_token?: string }> => {
  const response = await fetch('/api/sp-api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.error || resData.message || 'SP-API connection test failed');
  }
  return resData;
};

export const importListingsFromSpApiProxy = async (config: SpApiConfig): Promise<{ success: boolean; count: number; items: any[] }> => {
  const response = await fetch('/api/sp-api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'import', config })
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.error || resData.message || 'Failed to import listings from Amazon SP-API');
  }
  return resData;
};

export const publishListingToSpApiProxy = async (config: SpApiConfig, payload: SpApiListingPayload): Promise<{ success: boolean; message: string; submission_id?: string }> => {
  const response = await fetch('/api/sp-api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'publish', config, payload })
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.error || resData.message || 'Failed to publish listing to Amazon SP-API');
  }
  return resData;
};
