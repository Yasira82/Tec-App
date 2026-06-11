import { describe, it, expect } from 'vitest';
import { DOMAIN_REGISTRY }      from '@/domains/_registry';
import { t }                    from '@/domains/_types';

describe('DOMAIN_REGISTRY', () => {
  it('exports a non-empty registry', () => {
    expect(Object.keys(DOMAIN_REGISTRY).length).toBeGreaterThan(0);
  });

  it('tec domain exists with required fields', () => {
    const tec = DOMAIN_REGISTRY['tec'];
    expect(tec).toBeDefined();
    expect(tec.slug).toBe('tec');
    expect(tec.layer).toBe('os');
    expect(tec.status).toBe('live');
    expect(tec.name.en).toBeTruthy();
    expect(tec.route).toBeTruthy();
  });

  it('every domain has required fields', () => {
    for (const [slug, domain] of Object.entries(DOMAIN_REGISTRY)) {
      expect(domain.slug, `slug mismatch for ${slug}`).toBe(slug);
      expect(domain.name.en, `missing name.en for ${slug}`).toBeTruthy();
      expect(domain.status, `missing status for ${slug}`).toBeTruthy();
      expect(domain.layer, `missing layer for ${slug}`).toBeTruthy();
      expect(domain.features, `missing features for ${slug}`).toBeDefined();
      expect(domain.api, `missing api for ${slug}`).toBeDefined();
    }
  });

  it('all domains have valid status values', () => {
    const validStatuses = new Set(['live', 'beta', 'coming_soon', 'maintenance']);
    for (const [slug, domain] of Object.entries(DOMAIN_REGISTRY)) {
      expect(validStatuses.has(domain.status), `invalid status '${domain.status}' for ${slug}`).toBe(true);
    }
  });

  it('all domains have valid layer values', () => {
    const validLayers = new Set(['os', 'connector', 'core', 'domain', 'meta']);
    for (const [slug, domain] of Object.entries(DOMAIN_REGISTRY)) {
      expect(validLayers.has(domain.layer), `invalid layer '${domain.layer}' for ${slug}`).toBe(true);
    }
  });

  it('live domains have a route', () => {
    const liveDomains = Object.values(DOMAIN_REGISTRY).filter(d => d.status === 'live');
    expect(liveDomains.length).toBeGreaterThan(0);
    for (const domain of liveDomains) {
      expect(domain.route, `live domain ${domain.slug} missing route`).toBeTruthy();
    }
  });

  it('domains with requiresKYC are marked correctly', () => {
    const kycRequired = Object.values(DOMAIN_REGISTRY).filter(d => d.features.requiresKYC);
    for (const domain of kycRequired) {
      expect(typeof domain.features.requiresKYC).toBe('boolean');
    }
  });
});

describe('_types helpers', () => {
  it('t() returns english by default', () => {
    const loc = { en: 'Hello', ar: 'مرحبا' };
    expect(t(loc)).toBe('Hello');
    expect(t(loc, 'en')).toBe('Hello');
  });

  it('t() returns arabic when requested', () => {
    const loc = { en: 'Hello', ar: 'مرحبا' };
    expect(t(loc, 'ar')).toBe('مرحبا');
  });

  it('t() falls back to english when arabic missing', () => {
    const loc = { en: 'Hello' };
    expect(t(loc, 'ar')).toBe('Hello');
  });
});
