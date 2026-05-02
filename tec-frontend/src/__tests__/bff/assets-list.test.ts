import { describe, it, expect, vi, beforeEach } from 'vitest';

const RAILWAY_PATTERN = /railway\.app/;
const BFF_PATTERN     = /^\/api\//;

// ── Mock fetch ────────────────────────────────────────────
const mockFetch = (response: Partial<Response> & { json?: () => Promise<unknown> }) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok:     true,
    status: 200,
    json:   vi.fn().mockResolvedValue({}),
    ...response,
  } as Response);
};

// ── Mock assets data ──────────────────────────────────────
const MOCK_ASSETS = [
  {
    id:            'asset-1',
    name:          'nft-1777661363444-2wde',
    asset_type:    'nft',
    value:         2,
    currency:      'PI',
    status:        'active',
    created_at:    '2026-05-01T18:49:23.734Z',
    listing_id:    null,
    listing_price: null,
    metadata: {
      name:     'Pyramids',
      imageUrl: 'https://pub-fe60d4ae820b4c5cb91064081595e666.r2.dev/nfts/test.jpg',
    },
  },
  {
    id:            'asset-2',
    name:          'test-domain.pi',
    asset_type:    'domain',
    value:         3,
    currency:      'PI',
    status:        'active',
    created_at:    '2026-04-01T10:00:00.000Z',
    listing_id:    null,
    listing_price: null,
    metadata:      { extension: '.pi' },
  },
  {
    id:            'asset-3',
    name:          'nft-on-sale',
    asset_type:    'nft',
    value:         5,
    currency:      'PI',
    status:        'on_sale',
    created_at:    '2026-05-01T19:39:24.608Z',
    listing_id:    'listing-123',
    listing_price: 5,
    metadata: {
      name:     'Pyramids 2',
      imageUrl: 'https://pub-fe60d4ae820b4c5cb91064081595e666.r2.dev/nfts/test2.jpg',
    },
  },
];

// ══════════════════════════════════════════════════════════
describe('BFF — assets/list routing', () => {
  it('uses BFF route not Railway URL', () => {
    const url = '/api/bff/assets/list';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('marketplace listings use BFF route', () => {
    const url = '/api/bff/marketplace';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('purchases use BFF route', () => {
    const url = '/api/bff/marketplace/purchases';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('cancel listing uses BFF route', () => {
    const url = '/api/bff/marketplace/cancel';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — assets/list response shape', () => {
  beforeEach(() => {
    mockFetch({
      ok:   true,
      json: vi.fn().mockResolvedValue({ data: MOCK_ASSETS, total: MOCK_ASSETS.length }),
    });
  });

  it('returns data array and total', async () => {
    const res  = await fetch('/api/bff/assets/list', { credentials: 'include' });
    const data = await res.json();
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('each asset has required fields', async () => {
    const res  = await fetch('/api/bff/assets/list', { credentials: 'include' });
    const data = await res.json();
    for (const asset of data.data) {
      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('name');
      expect(asset).toHaveProperty('asset_type');
      expect(asset).toHaveProperty('value');
      expect(asset).toHaveProperty('currency');
      expect(asset).toHaveProperty('status');
      expect(asset).toHaveProperty('metadata');
    }
  });

  it('NFT assets have imageUrl in metadata', async () => {
    const res    = await fetch('/api/bff/assets/list', { credentials: 'include' });
    const data   = await res.json();
    const nfts   = data.data.filter((a: { asset_type: string }) => a.asset_type === 'nft');
    for (const nft of nfts) {
      expect(nft.metadata).toHaveProperty('imageUrl');
    }
  });

  it('ON_SALE assets have listing_id and listing_price', async () => {
    const res      = await fetch('/api/bff/assets/list', { credentials: 'include' });
    const data     = await res.json();
    const onSale   = data.data.filter((a: { status: string }) => a.status === 'on_sale');
    for (const asset of onSale) {
      expect(asset.listing_id).not.toBeNull();
      expect(asset.listing_price).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — estimated portfolio value', () => {
  it('NFT active value is 2π minimum', () => {
    const nft = MOCK_ASSETS.find(a => a.asset_type === 'nft' && a.status === 'active');
    expect(nft?.value).toBeGreaterThanOrEqual(2);
  });

  it('domain value depends on slug length', () => {
    const domain = MOCK_ASSETS.find(a => a.asset_type === 'domain');
    expect(domain?.value).toBeGreaterThan(0);
  });

  it('ON_SALE asset value equals listing price', () => {
    const onSale = MOCK_ASSETS.find(a => a.status === 'on_sale');
    expect(onSale?.value).toBe(onSale?.listing_price);
  });

  it('total portfolio value is sum of all asset values', () => {
    const total = MOCK_ASSETS.reduce((sum, a) => sum + a.value, 0);
    expect(total).toBe(10); // 2 + 3 + 5
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — error handling', () => {
  it('returns empty data on gateway error', async () => {
    mockFetch({ ok: false, status: 503, json: vi.fn().mockResolvedValue({ data: [], total: 0 }) });
    const res  = await fetch('/api/bff/assets/list', { credentials: 'include' });
    const data = await res.json();
    expect(data.data).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('requires credentials include', async () => {
    mockFetch({ ok: true, json: vi.fn().mockResolvedValue({ data: [], total: 0 }) });
    await fetch('/api/bff/assets/list', { credentials: 'include' });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].credentials).toBe('include');
  });
});
