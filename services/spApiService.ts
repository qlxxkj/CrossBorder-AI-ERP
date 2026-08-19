import { AmazonProduct, AmazonOrder, AmazonFeedLog } from '../types';

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
  quantity?: number;
  fulfillment_channel?: 'FBA' | 'FBM';
  bullet_points?: string[];
  description?: string;
  main_image?: string;
}

const SP_API_CONFIG_KEY = 'amzbot_sp_api_config';
const AMAZON_PRODUCTS_KEY = 'amzbot_amazon_products';
const AMAZON_ORDERS_KEY = 'amzbot_amazon_orders';
const AMAZON_FEEDS_KEY = 'amzbot_amazon_feed_logs';

export const getStoredSpApiConfig = (): SpApiConfig => {
  try {
    const raw = localStorage.getItem(SP_API_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local SP-API config', e);
  }
  return {
    seller_id: (process.env.AMAZON_SP_SELLER_ID as string) || '',
    lwa_client_id: (process.env.AMAZON_SP_LWA_CLIENT_ID as string) || '',
    lwa_client_secret: (process.env.AMAZON_SP_LWA_CLIENT_SECRET as string) || '',
    refresh_token: (process.env.AMAZON_SP_REFRESH_TOKEN as string) || '',
    region: ((process.env.AMAZON_SP_REGION as any) || 'NA'),
    marketplace_id: (process.env.AMAZON_SP_MARKETPLACE_ID as string) || 'ATVPDKIKX0DER',
    app_type: 'private'
  };
};

export const saveStoredSpApiConfig = (config: SpApiConfig): void => {
  localStorage.setItem(SP_API_CONFIG_KEY, JSON.stringify({
    ...config,
    updated_at: new Date().toISOString()
  }));
};

// ==========================================
// Amazon Products Local/Session Storage Management
// ==========================================
export const getStoredAmazonProducts = (): AmazonProduct[] => {
  try {
    const raw = localStorage.getItem(AMAZON_PRODUCTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse stored Amazon products', e);
  }
  return [];
};

export const saveStoredAmazonProducts = (products: AmazonProduct[]): void => {
  localStorage.setItem(AMAZON_PRODUCTS_KEY, JSON.stringify(products));
};

export const upsertAmazonProduct = (product: AmazonProduct): AmazonProduct[] => {
  const current = getStoredAmazonProducts();
  const index = current.findIndex(p => p.sku === product.sku || (p.asin && p.asin === product.asin && p.marketplace === product.marketplace));
  let updated: AmazonProduct[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...product, last_synced_at: new Date().toISOString() };
  } else {
    updated = [product, ...current];
  }
  saveStoredAmazonProducts(updated);
  return updated;
};

export const deleteStoredAmazonProduct = (id: string): AmazonProduct[] => {
  const current = getStoredAmazonProducts();
  const updated = current.filter(p => p.id !== id);
  saveStoredAmazonProducts(updated);
  return updated;
};

// ==========================================
// Amazon Orders Local/Session Storage Management
// ==========================================
export const getStoredAmazonOrders = (): AmazonOrder[] => {
  try {
    const raw = localStorage.getItem(AMAZON_ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse stored Amazon orders', e);
  }
  return [];
};

export const saveStoredAmazonOrders = (orders: AmazonOrder[]): void => {
  localStorage.setItem(AMAZON_ORDERS_KEY, JSON.stringify(orders));
};

export const upsertAmazonOrders = (newOrders: AmazonOrder[]): AmazonOrder[] => {
  const current = getStoredAmazonOrders();
  const map = new Map<string, AmazonOrder>();
  current.forEach(o => map.set(o.amazon_order_id, o));
  newOrders.forEach(o => map.set(o.amazon_order_id, { ...map.get(o.amazon_order_id), ...o }));
  const updated = Array.from(map.values()).sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
  saveStoredAmazonOrders(updated);
  return updated;
};

// ==========================================
// Amazon Feed Submission Logs
// ==========================================
export const getStoredFeedLogs = (): AmazonFeedLog[] => {
  try {
    const raw = localStorage.getItem(AMAZON_FEEDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse stored Amazon feed logs', e);
  }
  return [];
};

export const addFeedLog = (log: AmazonFeedLog): AmazonFeedLog[] => {
  const current = getStoredFeedLogs();
  const updated = [log, ...current].slice(0, 50); // Keep latest 50 logs
  localStorage.setItem(AMAZON_FEEDS_KEY, JSON.stringify(updated));
  return updated;
};

// ==========================================
// SP-API Network Calls
// ==========================================
export const testSpApiConnectionProxy = async (config: SpApiConfig): Promise<{ 
  success: boolean; 
  message: string; 
  seller_id?: string;
  region?: string;
  marketplace_id?: string;
  access_token_type?: string; 
  expires_in?: number;
  details?: any;
}> => {
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

export interface SpApiImportResult {
  success: boolean;
  count: number;
  items: AmazonProduct[];
  source?: string;
  message?: string;
  error?: string;
  diagnostic?: {
    region: string;
    marketplace_id: string;
    seller_id: string;
    lastApiError?: string;
    suggestions?: string[];
  };
  logs?: string[];
  raw_response?: any;
}

export const importListingsFromSpApiProxy = async (config: SpApiConfig): Promise<SpApiImportResult> => {
  const response = await fetch('/api/sp-api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'import', config })
  });

  const resData = await response.json();
  if (!response.ok && !resData.diagnostic) {
    throw new Error(resData.error || resData.message || 'Failed to import listings from Amazon SP-API');
  }
  
  if (Array.isArray(resData.items) && resData.items.length > 0) {
    // Save to local Amazon products storage
    const current = getStoredAmazonProducts();
    const map = new Map<string, AmazonProduct>();
    current.forEach(p => map.set(p.sku, p));
    resData.items.forEach((p: AmazonProduct) => map.set(p.sku, p));
    const merged = Array.from(map.values());
    saveStoredAmazonProducts(merged);
    resData.items = merged;
  }

  return resData;
};

export const publishListingToSpApiProxy = async (
  config: SpApiConfig, 
  payload: SpApiListingPayload
): Promise<{ 
  success: boolean; 
  message: string; 
  submission_id?: string; 
  status?: string; 
  issues?: any[];
  raw_response?: any;
}> => {
  const response = await fetch('/api/sp-api/listings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'publish', config, payload })
  });

  const resData = await response.json();
  if (!response.ok) {
    const errorMsg = resData.error || resData.message || (resData.issues ? JSON.stringify(resData.issues) : 'Failed to publish listing to Amazon SP-API');
    
    // Log failed attempt
    addFeedLog({
      id: `log-${Date.now()}`,
      submission_id: resData.submission_id || `err-${Date.now()}`,
      feed_type: 'JSON_LISTINGS_FEED',
      marketplace_id: payload.marketplace_id || config.marketplace_id || 'ATVPDKIKX0DER',
      sku_list: [payload.sku],
      status: 'ERROR',
      error_details: resData.issues ? resData.issues.map((i: any) => `${i.code || i.severity}: ${i.message}`) : [errorMsg],
      response_summary: errorMsg,
      created_at: new Date().toISOString()
    });

    throw new Error(errorMsg);
  }

  // Record successful submission log
  addFeedLog({
    id: `log-${Date.now()}`,
    submission_id: resData.submission_id || `sub-${Date.now()}`,
    feed_type: 'JSON_LISTINGS_FEED',
    marketplace_id: payload.marketplace_id || config.marketplace_id || 'ATVPDKIKX0DER',
    sku_list: [payload.sku],
    status: (resData.status as any) || 'ACCEPTED',
    error_details: resData.issues?.map((i: any) => `[${i.severity}] ${i.message}`),
    response_summary: resData.message,
    created_at: new Date().toISOString()
  });

  // Also create or update product in local Amazon Products manager
  const newAmzProduct: AmazonProduct = {
    id: `amz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sku: payload.sku,
    asin: payload.asin || '',
    title: payload.title,
    brand: payload.brand || 'Generic',
    marketplace: payload.marketplace_id || config.marketplace_id || 'US',
    price: payload.price || 0,
    currency: 'USD',
    quantity: payload.quantity || 10,
    status: 'Active',
    fulfillment_channel: payload.fulfillment_channel || 'FBM',
    main_image: payload.main_image,
    bullet_points: payload.bullet_points,
    description: payload.description,
    feed_submission_id: resData.submission_id,
    submission_status: (resData.status as any) || 'ACCEPTED',
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  upsertAmazonProduct(newAmzProduct);

  return resData;
};

export const fetchAmazonOrdersProxy = async (
  config: SpApiConfig,
  filters?: {
    created_after?: string;
    order_statuses?: string[];
    marketplace_ids?: string[];
  }
): Promise<{
  success: boolean;
  count: number;
  orders: AmazonOrder[];
  raw_response?: any;
}> => {
  const response = await fetch('/api/sp-api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, filters })
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.error || resData.message || 'Failed to fetch orders from Amazon SP-API');
  }

  if (Array.isArray(resData.orders)) {
    upsertAmazonOrders(resData.orders);
  }

  return resData;
};
