/**
 * TEC AI names real products, or says there are none (lib/ai/product-search.ts).
 * From the second reading: "عاوز شاحن جوده وسعر" got a pointer to a shop.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isProductAsk, productTerms, rankProducts, searchProducts, productSection } from '@/lib/ai/product-search';

afterEach(() => vi.unstubAllGlobals());

describe('which asks search the marketplace', () => {
  it.each([
    'طيب ما انا قولتلك عاوز شاحن جوده وسعر',
    'عايز اشتري سماعة',
    'I want a phone charger',
    'do you have headphones?',
  ])('searches: %s', (ask) => expect(isProductAsk(ask)).toBe(true));

  it.each([
    'عاوز ابدأ ومش عاوز تطبيق تجارة',   // about apps
    'I want to save 50 pi for a phone',  // a goal
    'عاوز ابعت 5 باي لصاحبي',            // sending Pi
    'ايه أضعف خدمة',                     // not about buying at all
    'عاوز',                              // nothing to search for
  ])('does not: %s', (ask) => expect(isProductAsk(ask)).toBe(false));

  it('keeps the product words only', () => {
    expect(productTerms('طيب ما انا قولتلك عاوز شاحن جوده وسعر')).toEqual(['شاحن']);
    expect(productTerms('I want a cheap USB-C charger under 5 pi')).toEqual(['usb', 'charger']);
  });
});

describe('ranking keeps only rows that match', () => {
  const rows = [
    { id: 'a', title: 'Notebook', description: 'paper', price: '2', stock: 3 },
    { id: 'b', title: 'شاحن سريع 20W', description: '', price: '4.5', stock: 0 },
    { id: 'c', title: 'Cable', description: 'works with any شاحن', price: 1, stock: 9 },
    { id: '', title: 'no id' },
  ];

  it('drops a row matching no word — even if the service returned it', () => {
    const r = rankProducts(rows, ['شاحن']);
    expect(r.map(p => p.id)).toEqual(['b', 'c']);   // title hit outranks description hit
  });

  it('carries stock honestly and links the product page', () => {
    const [b] = rankProducts(rows, ['شاحن']);
    expect(b.inStock).toBe(false);
    expect(b.price).toBe('4.5');
    expect(b.url).toBe('https://ecommerce.tecosystem.app/product/b');
  });

  it('an absent price is null, never 0', () => {
    expect(rankProducts([{ id: 'x', title: 'شاحن' }], ['شاحن'])[0].price).toBeNull();
  });
});

describe('the search call', () => {
  it('asks commerce-service with q, and reports what it found', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { products: [{ id: 'b', title: 'شاحن', price: '4', stock: 2 }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await searchProducts('http://gw/', 'عاوز شاحن');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/commerce/products?q=');
    expect(r?.status).toBe('found');
  });

  it('nothing matching is "none" — even when the service ignored q and sent the newest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { products: [{ id: 'n', title: 'Notebook', price: '2', stock: 1 }] } }),
    }));
    expect((await searchProducts('http://gw', 'عاوز شاحن'))?.status).toBe('none');
  });

  it('a failure is "unavailable", never an empty shop', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect((await searchProducts('http://gw', 'عاوز شاحن'))?.status).toBe('unavailable');
  });
});

describe('what the model is told', () => {
  it('found: only this list, with links; no quality claims', () => {
    const s = productSection({ status: 'found', terms: ['شاحن'], products: [
      { id: 'b', title: 'شاحن', price: '4', inStock: false, url: 'https://ecommerce.tecosystem.app/product/b' },
    ] });
    expect(s).toMatch(/Recommend ONLY from this list/);
    expect(s).toMatch(/OUT OF STOCK/);
    expect(s).toMatch(/never claim one is\s+better made/);
  });

  it('none and unavailable say different things', () => {
    expect(productSection({ status: 'none', terms: ['x'] })).toMatch(/NOTHING listed matches/);
    expect(productSection({ status: 'unavailable', terms: ['x'] })).toMatch(/could not search/);
  });

  it('the route searches before building the prompt, and never through the intent instrument', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/ai/chat/route.ts'), 'utf8');
    expect(route).toMatch(/isProductAsk\(lastUserText\)/);
    expect(route).toMatch(/productSection\(products\)/);
    expect(route).not.toMatch(/observation\??\.objective[\s\S]{0,80}searchProducts/);
  });
});
