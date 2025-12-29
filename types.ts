
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
  user_id?: string;
  asin: string;
  marketplace: string; // 新增字段：所属站点 (US, UK, DE, JP 等)
  url?: string;
  created_at: string;
  updated_at?: string;
  status: 'collected' | 'optimizing' | 'optimized';
  cleaned: CleanedData;
  optimized?: OptimizedData;
  translations?: Record<string, OptimizedData>;
}

export interface FieldMapping {
  header: string;
  source: 'listing' | 'custom' | 'random' | 'template_default';
  listingField?: string; 
  defaultValue?: string;
  templateDefault?: string;
  acceptedValues?: string[]; 
}

export interface ExportTemplate {
  id: string;
  name: string;
  headers: string[];
  required_headers?: string[];
  mappings?: Record<string, any>; 
  marketplace: string;
  created_at: string;
}

export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  LISTING_DETAIL = 'LISTING_DETAIL',
  TEMPLATES = 'TEMPLATES'
}

export type UILanguage = 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es';
