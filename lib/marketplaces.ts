
export interface MarketplaceConfig {
  code: string;
  name: string;
  flag: string;
  currency: string;
  lang: string;
  domain: string;
}

export const AMAZON_MARKETPLACES: MarketplaceConfig[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: '$', lang: 'en', domain: 'amazon.com' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: '$', lang: 'en', domain: 'amazon.ca' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', currency: '$', lang: 'es', domain: 'amazon.com.mx' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', currency: 'R$', lang: 'pt', domain: 'amazon.com.br' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', currency: '£', lang: 'en', domain: 'amazon.co.uk' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: '€', lang: 'de', domain: 'amazon.de' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: '€', lang: 'fr', domain: 'amazon.fr' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', currency: '€', lang: 'it', domain: 'amazon.it' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', currency: '€', lang: 'es', domain: 'amazon.es' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', currency: '€', lang: 'en', domain: 'amazon.ie' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', currency: 'zł', lang: 'pl', domain: 'amazon.pl' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', currency: '€', lang: 'nl', domain: 'amazon.nl' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', currency: 'kr', lang: 'sv', domain: 'amazon.se' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', currency: '€', lang: 'fr', domain: 'amazon.com.be' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: '¥', lang: 'ja', domain: 'amazon.co.jp' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: '$', lang: 'en', domain: 'amazon.com.au' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: '$', lang: 'en', domain: 'amazon.sg' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', currency: 'E£', lang: 'ar', domain: 'amazon.eg' },
];
