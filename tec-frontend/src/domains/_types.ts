export type DomainStatus = 'live' | 'beta' | 'coming_soon' | 'maintenance';

export type DomainLayer =
  | 'os'         // TEC Control Plane
  | 'connector'  // Nexus — Identity + Routing
  | 'core'       // Core Capabilities (Assets, Commerce)
  | 'domain'     // Domain Apps
  | 'meta';      // Analytics — cross-cutting

export type DomainGroup =
  | 'finance'
  | 'commerce'
  | 'social'
  | 'real_world'
  | 'tech'
  | 'prestige'
  | 'premium'
  | 'platform';  // OS + Connector + Core

export interface DomainFeatures {
  hasNotifications: boolean;
  hasAnalytics:     boolean;
  requiresKYC:      boolean;
  requiresPro:      boolean;
}

export interface DomainConfig {
  slug:           string;
  name:           string;
  piDomain:       string;
  emoji:          string;
  description:    string;
  status:         DomainStatus;
  layer:          DomainLayer;
  group:          DomainGroup;
  route:          string | null;
  features:       DomainFeatures;
  backendService: string;
  dependsOn:      string[];      // Core services this domain needs
  order:          number;
  children?:      string[];      // Sub-pages inside this app
}
