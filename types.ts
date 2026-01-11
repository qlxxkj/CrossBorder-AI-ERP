
export interface Category {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CleanedData {
  asin: string;
  title: string;
  brand: string;
  price: number;
  strike_price?: number;
  shipping?: number;
  features: string[];
  description: string;
  main_image: string;
  other_images?: string[];
  reviews?: string;
  ratings?: string;
  category?: string;
  BSR?: string;
  item_weight?: string;
  product_dimensions?: string;
  OEM_Part_Number?: string;
  Date_First_Available?: string;
  bought_in_past_month?: string;
  sourcing_links?: string[];
  updated_at?: string;
  [key: string]: any;
}

export interface OptimizedData {
  optimized_title: string;
  optimized_features: string[];
  optimized_description: string;
  search_keywords: string;
}

export interface Listing {
  id: string;
  user_id?: string;
  asin: string;
  marketplace: string; 
  category_id?: string;
  url?: string;
  created_at: string;
  updated_at?: string;
  status: 'collected' | 'optimizing' | 'optimized';
  cleaned: CleanedData;
  raw?: any;
  optimized?: OptimizedData;
  translations?: Record<string, OptimizedData>;
}

export interface PriceAdjustment {
  id: string;
  user_id: string;
  marketplace: string; // 'ALL' or code
  category_id: string; // 'ALL' or uuid
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
  source: 'listing' | 'custom' | 'random' | 'template_default';
  listingField?: string; 
  defaultValue?: string;
  templateDefault?: string;
  randomType?: 'alphanumeric' | 'ean13';
  acceptedValues?: string[]; 
}

export interface ExportTemplate {
  id: string;
  name: string;
  headers: string[];
  required_headers?: string[];
  mappings?: Record<string, any>; 
  marketplace: string;
  category_id?: string;
  created_at: string;
}

export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  LISTING_DETAIL = 'LISTING_DETAIL',
  TEMPLATES = 'TEMPLATES',
  CATEGORIES = 'CATEGORIES',
  PRICING = 'PRICING'
}

export type UILanguage = 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es';
