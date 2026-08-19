
export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  plan_type: 'Free' | 'Pro' | 'Elite';
  credits_total: number;
  credits_used: number;
  created_at: string;
  // 新增字段
  address?: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface UserProfile {
  id: string;
  org_id: string | null;
  role: string; // 支持内置角色和自定义角色 ID
  email?: string; // 新增 Email
  is_suspended?: boolean;
  last_login_at?: string;
  created_at?: string;
  credits_total: number;
  credits_used: number;
  plan_type: 'Free' | 'Pro' | 'Elite';
  last_credit_reset_at?: string; // 上次重置免费积分的时间
}

export interface RolePermission {
  menu_id: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export interface Role {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  permissions: RolePermission[];
  created_at: string;
}

export interface CleanedData {
  asin: string;
  title: string;
  brand?: string;
  price?: number;
  shipping?: number;
  description?: string;
  features?: string[];
  search_keywords?: string;
  main_image?: string;
  other_images?: string[];
  item_weight?: string;
  item_weight_value?: string;
  item_weight_unit?: string;
  item_length?: string;
  item_width?: string;
  item_height?: string;
  item_size_unit?: string;
  product_dimensions?: string;
  BSR?: string;
  ratings?: string;
  reviews?: string;
  category?: string;
  final_price?: number;
  parent_asin?: string;
  strike_price?: number;
  coupon_amount?: string | null;
  updated_at?: string;
  [key: string]: any;
}

export interface OptimizedData {
  optimized_title: string;
  optimized_features: string[];
  optimized_description: string;
  search_keywords: string;
  optimized_weight_value?: string;
  optimized_weight_unit?: string;
  optimized_length?: string;
  optimized_width?: string;
  optimized_height?: string;
  optimized_size_unit?: string;
  optimized_price?: number;
  optimized_shipping?: number;
  // Image Optimization Fields
  optimized_main_image?: string;
  optimized_other_images?: string[];
}

export interface SourcingRecord {
  id: string;
  title: string;
  price: string;
  url: string;
  image: string;
}

export type SourcingProduct = SourcingRecord;

export interface Listing {
  id: string;
  user_id?: string;
  org_id?: string; // 归属于组织
  asin: string;
  marketplace: string; 
  category_id?: string;
  url?: string;
  created_at: string;
  updated_at?: string;
  status: 'collected' | 'optimizing' | 'optimized';
  cleaned: CleanedData;
  optimized?: OptimizedData;
  translations?: Record<string, OptimizedData>;
  sourcing_data?: SourcingRecord[];
  exported_marketplaces?: string[];
}

export interface Category {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
}

export interface PriceAdjustment {
  id: string;
  user_id: string;
  marketplace: string;
  category_id: string;
  percentage: number;
  include_shipping: boolean;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  user_id: string;
  marketplace: string;
  rate: number;
  created_at: string;
}

export interface InfringementWord {
  id: string;
  org_id: string;
  word: string;
  created_at: string;
}

export interface BillingManagement {
  id: string;
  category: 'credit_setting' | 'unit_price';
  name?: string; // for credit_setting
  unit_type?: 'token_per_credit'; // for credit_setting
  value?: number; // for credit_setting
  service_name?: string; // for unit_price (AI Engine name)
  price_usd?: number; // for unit_price
  price_cny?: number; // for unit_price
  updated_at: string;
}

export interface FieldMapping {
  header: string;
  source: 'custom' | 'listing' | 'random' | 'template_default';
  listingField?: string;
  defaultValue?: string;
  templateDefault?: string;
  randomType?: 'alphanumeric' | 'ean13';
}

export interface ExportTemplate {
  id: string;
  user_id: string;
  name: string;
  headers: string[];
  mappings: Record<string, any>;
  marketplace: string;
  category_id?: string;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  name_zh: string;
  price_usd: number;
  price_cny: number;
  credits: number;
  features: string[];
  features_zh: string[];
}

export interface UsageLog {
  id: string;
  user_id: string;
  service_name: string;
  action_type: 'optimization' | 'translation';
  tokens_used: number;
  credits_deducted: number;
  created_at: string;
}

export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  LISTINGS = 'LISTINGS', // 新增：产品列表显式路由
  LISTING_DETAIL = 'LISTING_DETAIL',
  TEMPLATES = 'TEMPLATES',
  CATEGORIES = 'CATEGORIES',
  PRICING = 'PRICING',
  BILLING = 'BILLING',
  ADMIN = 'ADMIN', 
  SYSTEM_MGMT = 'SYSTEM_MGMT',
  AMAZON_LISTINGS = 'AMAZON_LISTINGS',
  AMAZON_ORDERS = 'AMAZON_ORDERS',
  AMAZON_SETTINGS = 'AMAZON_SETTINGS'
}

export interface AmazonProduct {
  id: string;
  sku: string;
  asin: string;
  parent_asin?: string;
  parent_sku?: string;
  is_parent?: boolean;
  variation_theme?: string;
  variation_name?: string;
  variation_values?: Record<string, string>;
  children_count?: number;
  children?: AmazonProduct[];
  title: string;
  brand?: string;
  marketplace: string;
  price: number;
  currency: string;
  quantity: number;
  status: 'Active' | 'Inactive' | 'Draft' | 'Syncing' | 'Error';
  fulfillment_channel: 'FBA' | 'FBM' | 'DEFAULT' | 'AMAZON_NA' | 'AMAZON_EU';
  main_image?: string;
  bullet_points?: string[];
  description?: string;
  feed_submission_id?: string;
  submission_status?: 'SUBMITTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'DONE' | 'FATAL' | 'ERROR';
  submission_errors?: string[];
  last_synced_at: string;
  created_at: string;
}

export interface AmazonOrderItem {
  asin: string;
  sku: string;
  title: string;
  quantity_ordered: number;
  quantity_shipped: number;
  item_price?: { amount: number; currency: string };
  image?: string;
}

export interface AmazonOrder {
  id: string;
  amazon_order_id: string;
  purchase_date: string;
  last_update_date?: string;
  order_status: 'Pending' | 'Unshipped' | 'PartiallyShipped' | 'Shipped' | 'Canceled' | 'InvoiceUnconfirmed';
  fulfillment_channel: 'AFN' | 'MFN'; // AFN = FBA, MFN = FBM
  sales_channel?: string;
  ship_service_level?: string;
  order_total: { amount: number; currency: string };
  number_of_items_shipped: number;
  number_of_items_unshipped: number;
  payment_method?: string;
  marketplace_id: string;
  buyer_info?: { buyer_email?: string; buyer_name?: string };
  shipping_address?: {
    name?: string;
    city?: string;
    state_or_region?: string;
    postal_code?: string;
    country_code?: string;
    street?: string;
  };
  order_items?: AmazonOrderItem[];
}

export interface AmazonFeedLog {
  id: string;
  submission_id: string;
  feed_type: string;
  marketplace_id: string;
  sku_list: string[];
  status: 'SUBMITTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'DONE' | 'FATAL' | 'ERROR';
  error_details?: string[];
  response_summary?: string;
  created_at: string;
}

export type UILanguage = 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es';
