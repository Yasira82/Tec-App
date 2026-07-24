export interface PiPrice {
  price:    number;
  change24h: number;
  high24h:  number;
  low24h:   number;
}

export interface HubApp {
  slug:  string;
  name:  string;
  emoji: string;
  href:  string;
  desc:  string;
  group?: string;
}
