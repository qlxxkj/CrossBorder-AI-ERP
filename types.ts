
export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  plan_type: 'Free' | 'Pro' | 'Elite';
  credits_total: number;
  credits_used: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  org_id: string | null;
  role: 'super_admin' | 'tenant_admin' | 'user' | 'admin';
  is_suspended?: boolean;
  last_login_at?: string;
  created_at?: string;
  credits_total: number;
  credits_used: number;
  plan_type: 'Free' | 'Pro' | 'Elite';
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

export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  LISTING_DETAIL = 'LISTING_DETAIL',
  TEMPLATES = 'TEMPLATES',
  CATEGORIES = 'CATEGORIES',
  PRICING = 'PRICING',
  BILLING = 'BILLING',
  ADMIN = 'ADMIN', // 超级管理员视图
  SYSTEM_MGMT = 'SYSTEM_MGMT' // 租户管理员视图
}

export type UILanguage = 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es';
