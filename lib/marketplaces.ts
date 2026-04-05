
export interface MarketplaceConfig {
  code: string;
  name: string;
  flag: string;
  currency: string;
  lang: string;
  langName: string; // Explicit language name for AI
  domain: string;
}

export const MARKETPLACES: MarketplaceConfig[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: '$', lang: 'en', langName: 'English', domain: 'amazon.com' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: '$', lang: 'en', langName: 'English', domain: 'amazon.ca' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: '$', lang: 'es', langName: 'Spanish', domain: 'amazon.com.mx' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'R$', lang: 'pt', langName: 'Portuguese', domain: 'amazon.com.br' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', currency: '£', lang: 'en', langName: 'English', domain: 'amazon.co.uk' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: '€', lang: 'de', langName: 'German', domain: 'amazon.de' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: '€', lang: 'fr', langName: 'French', domain: 'amazon.fr' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', currency: '€', lang: 'it', langName: 'Italian', domain: 'amazon.it' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', currency: '€', lang: 'es', langName: 'Spanish', domain: 'amazon.es' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', currency: '€', lang: 'en', langName: 'English', domain: 'amazon.ie' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', currency: 'zł', lang: 'pl', langName: 'Polish', domain: 'amazon.pl' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: '€', lang: 'nl', langName: 'Dutch', domain: 'amazon.nl' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', currency: 'kr', lang: 'sv', langName: 'Swedish', domain: 'amazon.se' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', currency: '€', lang: 'fr', langName: 'French', domain: 'amazon.com.be' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: '¥', lang: 'ja', langName: 'Japanese', domain: 'amazon.co.jp' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: '$', lang: 'en', langName: 'English', domain: 'amazon.com.au' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: '$', lang: 'en', langName: 'English', domain: 'amazon.sg' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', currency: 'E£', lang: 'ar', langName: 'Arabic', domain: 'amazon.eg' },
];

export const SPECIAL_MARKETPLACES = [
  { code: 'ZY_ERP', name: '智赢ERP', flag: '📦', currency: 'CNY', lang: 'zh', langName: 'Chinese', domain: 'zyerp.com' },
];
