
export interface CleanedData {
  asin: string;
  title: string;
  brand: string;
  price: number;
  shipping?: number;
  features: string[];
  description: string;
  main_image: string;
  other_images?: string[];
  reviews?: string;
  ratings?: string;
  category?: string;
  item_weight?: string;
  product_dimensions?: string;
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
  asin: string;
  url?: string;
  created_at: string;
  updated_at?: string; // 根级时间戳
  status: 'collected' | 'optimizing' | 'optimized';
  cleaned: CleanedData;
  optimized?: OptimizedData;
  translations?: Record<string, OptimizedData>; // 特定市场翻译
}

export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  LISTING_DETAIL = 'LISTING_DETAIL'
}

export type UILanguage = 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es';
