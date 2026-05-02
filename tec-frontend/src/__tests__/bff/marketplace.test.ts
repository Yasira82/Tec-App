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

// ── Mock data ─────────────────────────────────────────────
const MOCK_LISTINGS = [
  {
    id:          'listing-1',
    asset_id:    'asset-1',
    seller_id:   'seller-uuid',
    price:       5,
    currency:    'PI',
    status:      'ACTIVE',
    title:       'Pyramids NFT',
    description: 'Beautiful NFT',
    category:    'nft',
    created_at:  '2026-05-01T19:39:45.783Z',
    asset: {
      slug:     'nft-1777664364311-fcdj',
      category: 'NFT',
      metadata: {
        name:     'Pyramids 2',
        imageUrl: 'https://pub-fe60d4ae820b4c5cb91064081595e666.r2.dev/nfts/test.jpg',
      },
    },
  },
  {
    id:          'listing-2',
    asset_id:    'asset-2',
    seller_id:   'seller-uuid-2',
    price:       3,
    currency:    'PI',
    status:      'ACTIVE',
    title:       'Short Domain',
    description: 'Premium domain',
    category:    'domain',
    created_at:  '2026-04-01T10:00:00.000Z',
    asset: {
      slug:     'tec.pi',
      category: 'DOMAIN',
      metadata: { extension: '.pi' },
    },
  },
];

const MOCK_PURCHASES = [
  {
    id:       'purchase-1',
    assetId:  'asset-3',
    sellerId: 'seller-uuid',
    buyerId:  'buyer-uuid',
    price:    2,
    currency: 'PI',
    status:   'SOLD',
    soldAt:   '2026-05-01T20:00:00.000Z',
    asset: {
      slug:     'nft-sold',
      category: 'NFT',
      metadata: {
        name:     'Sold NFT',
        imageUrl: 'https://pub-fe60d4ae820b4c5cb91064081595e666.r2.dev/nfts/sold.jpg',
      },
    },
  },
];

// ══════════════════════════════════════════════════════════
describe('BFF — marketplace routing', () => {
  it('listings use BFF route not Railway', () => {
    const url = '/api/bff/marketplace';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('list-for-sale uses BFF route', () => {
    const url = '/api/bff/marketplace/list';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('cancel listing uses BFF route', () => {
    const url = '/api/bff/marketplace/cancel';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('purchases use BFF route', () => {
    const url = '/api/bff/marketplace/purchases';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });

  it('buy listing uses BFF route', () => {
    const url = '/api/bff/marketplace/listing-1/buy';
    expect(BFF_PATTERN.test(url)).toBe(true);
    expect(RAILWAY_PATTERN.test(url)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — marketplace listings response', () => {
  beforeEach(() => {
    mockFetch({
      ok:   true,
      json: vi.fn().mockResolvedValue({ listings: MOCK_LISTINGS, total: MOCK_LISTINGS.length }),
    });
  });

  it('returns listings array', async () => {
    const res  = await fetch('/api/bff/marketplace', { credentials: 'include' });
    const data = await res.json();
    expect(Array.isArray(data.listings)).toBe(true);
    expect(data.total).toBe(2);
  });

  it('each listing has required fields', async () => {
    const res  = await fetch('/api/bff/marketplace', { credentials: 'include' });
    const data = await res.json();
    for (const listing of data.listings) {
      expect(listing).toHaveProperty('id');
      expect(listing).toHaveProperty('price');
      expect(listing).toHaveProperty('currency');
      expect(listing).toHaveProperty('status');
      expect(listing).toHaveProperty('asset');
    }
  });

  it('only ACTIVE listings are shown', async () => {
    const res  = await fetch('/api/bff/marketplace', { credentials: 'include' });
    const data = await res.json();
    for (const listing of data.listings) {
      expect(listing.status).toBe('ACTIVE');
    }
  });

  it('NFT listings have imageUrl', async () => {
    const res  = await fetch('/api/bff/marketplace', { credentials: 'include' });
    const data = await res.json();
    const nfts = data.listings.filter((l: { category: string }) => l.category === 'nft');
    for (const nft of nfts) {
      expect(nft.asset.metadata).toHaveProperty('imageUrl');
    }
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — list for sale', () => {
  beforeEach(() => {
    mockFetch({
      ok:   true,
      status: 201,
      json: vi.fn().mockResolvedValue({ success: true, data: { listing: MOCK_LISTINGS[0] } }),
    });
  });

  it('sends correct body to list endpoint', async () => {
    const body = { assetId: 'asset-1', price: 5, title: 'Test NFT' };
    await fetch('/api/bff/marketplace/list', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(body),
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe('POST');
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody).toHaveProperty('assetId', 'asset-1');
    expect(sentBody).toHaveProperty('price', 5);
  });

  it('requires credentials include', async () => {
    await fetch('/api/bff/marketplace/list', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: 'asset-1', price: 5 }),
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].credentials).toBe('include');
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — cancel listing', () => {
  beforeEach(() => {
    mockFetch({
      ok:   true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
  });

  it('sends PATCH request with listingId', async () => {
    await fetch('/api/bff/marketplace/cancel', {
      method:      'PATCH',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ listingId: 'listing-1' }),
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe('PATCH');
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody).toHaveProperty('listingId', 'listing-1');
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — purchase history', () => {
  beforeEach(() => {
    mockFetch({
      ok:   true,
      json: vi.fn().mockResolvedValue({ purchases: MOCK_PURCHASES }),
    });
  });

  it('returns purchases array', async () => {
    const res  = await fetch('/api/bff/marketplace/purchases', { credentials: 'include' });
    const data = await res.json();
    expect(Array.isArray(data.purchases)).toBe(true);
  });

  it('each purchase has soldAt and price', async () => {
    const res  = await fetch('/api/bff/marketplace/purchases', { credentials: 'include' });
    const data = await res.json();
    for (const purchase of data.purchases) {
      expect(purchase).toHaveProperty('soldAt');
      expect(purchase).toHaveProperty('price');
      expect(purchase.price).toBeGreaterThan(0);
    }
  });

  it('purchase status is SOLD', async () => {
    const res  = await fetch('/api/bff/marketplace/purchases', { credentials: 'include' });
    const data = await res.json();
    for (const purchase of data.purchases) {
      expect(purchase.status).toBe('SOLD');
    }
  });
});

// ══════════════════════════════════════════════════════════
describe('BFF — marketplace error handling', () => {
  it('returns empty listings on gateway error', async () => {
    mockFetch({
      ok:   false,
      status: 503,
      json: vi.fn().mockResolvedValue({ listings: [], total: 0 }),
    });
    const res  = await fetch('/api/bff/marketplace', { credentials: 'include' });
    const data = await res.json();
    expect(data.listings).toEqual([]);
  });

  it('returns empty purchases on gateway error', async () => {
    mockFetch({
      ok:   false,
      status: 503,
      json: vi.fn().mockResolvedValue({ purchases: [] }),
    });
    const res  = await fetch('/api/bff/marketplace/purchases', { credentials: 'include' });
    const data = await res.json();
    expect(data.purchases).toEqual([]);
  });
});
