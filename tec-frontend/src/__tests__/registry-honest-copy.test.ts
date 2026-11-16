/**
 * The registry's words are what a pioneer reads under each app in the Hub, and what the
 * launch kit copies (KB marketing: SSoT = registry valueProp). They must describe what
 * the app does today (owner, 16 Nov 2026 — Round 3 credibility review):
 *   · VIP: no owning app gives a VIP benefit yet → benefits are "coming", not "unlocked".
 *   · Titan: no organization can be created → it is a preview, not "run your organization".
 *   · Ecommerce: nothing in the app delivers anything → no "delivery".
 *   · Assets: properties are shown and handled in Estate, not Assets → no "Real Estate".
 */
import { describe, it, expect } from 'vitest';
import { ALL_DOMAINS as DOMAINS } from '@/domains/_registry';

const app = (slug: string) => {
  const d = DOMAINS.find((x) => x.slug === slug);
  if (!d) throw new Error(slug);
  return `${d.description.en} ${d.description.ar} ${d.valueProp?.en ?? ''} ${d.valueProp?.ar ?? ''}`;
};

describe('registry copy says what each Round 3 app does today', () => {
  it('VIP: benefits are coming, not unlocked', () => {
    expect(app('vip')).not.toMatch(/unlock|افتح/i);
    expect(app('vip')).toMatch(/coming/i);
  });
  it('Titan: a preview, not a console you run your organization in', () => {
    expect(app('titan')).not.toMatch(/run your organization|شغّل مؤسستك/i);
    expect(app('titan')).toMatch(/preview/i);
  });
  it('Ecommerce: no delivery', () => {
    expect(app('ecommerce')).not.toMatch(/deliver|توصيل/i);
  });
  it('Assets: no real estate', () => {
    expect(app('assets')).not.toMatch(/real estate|عقار/i);
  });
});
