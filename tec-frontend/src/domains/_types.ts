export type DomainStatus   = 'live' | 'beta' | 'coming_soon' | 'maintenance';
export type DomainCategory = 'finance' | 'commerce' | 'social' | 'tools' | 'premium';

export interface DomainFeatures {
  hasNotifications: boolean;
  hasAnalytics:     boolean;
  requiresKYC:      boolean;
  requiresPro:      boolean;
}

export interface DomainConfig {
  slug:            string;
  name:            string;
  piDomain:        string;
  emoji:           string;
  description:     string;
  status:          DomainStatus;
  route:           string | null;
  features:        DomainFeatures;
  backendService:  string;
  order:           number;
  category:        DomainCategory;
}
