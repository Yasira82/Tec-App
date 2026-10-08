/**
 * TEC AI's product search — the assistant names REAL products, or says there are none.
 *
 * The second reading (2026-10-08) had "عاوز شاحن جوده وسعر" answered with a pointer to
 * a shop. Now, when the person's ask is about finding a product, the chat route
 * searches the live catalogue first (commerce-service `GET /commerce/products?q=`,
 * public, ACTIVE products only) and hands the model what it found.
 *
 * Three rules shape this file:
 *  1. **Only what matched.** commerce-service ORs the words; this file re-checks every
 *     row and drops one that matches none of them. That also keeps the Hub honest
 *     against a commerce-service that has not deployed `q` yet — it would ignore the
 *     filter and return the newest products, none of which would be shown.
 *  2. **The model can only repeat it.** Title, price, stock and the product page — no
 *     seller identity, no description beyond the title. An unknown price is "—", never 0.
 *  3. **It cannot block the answer.** A short timeout; a failure is reported to the model
 *     as "could not search", so it says so instead of pretending the shop is empty.
 */

export const ECOMMERCE_ORIGIN = 'https://ecommerce.tecosystem.app';
const TIMEOUT_MS = 2000;
const SHOW = 4;

/** Words that carry the ask's shape, not the product — in the languages people used. */
const STOP = new Set([
  // Arabic (normalized: ة→ه, أ/إ/آ→ا, ى→ي)
  'عاوز', 'عايز', 'محتاج', 'اريد', 'ابغي', 'ابي', 'انا', 'ممكن', 'طيب', 'ما', 'قولتلك', 'لو', 'سمحت',
  'عندكم', 'عندك', 'في', 'فيه', 'هل', 'جوده', 'سعر', 'وسعر', 'بسعر', 'كويس', 'حلو', 'رخيص', 'ارخص',
  'اشتري', 'ادور', 'علي', 'عن', 'من', 'او', 'ايه', 'شو', 'حاجه', 'منتج', 'نفسي', 'بس', 'يكون', 'افضل',
  'باي', 'تحت', 'اقل', 'حدود',
  'متوفر', 'بكام', 'ابحث', 'دور', 'دورلي', 'لاقيلي', 'تلاقيلي', 'الاقي', 'هات', 'هاتلي', 'رشح',
  'رشحلي', 'انصحني', 'اقترح', 'اقترحلي', 'احسن', 'تعرف', 'لي', 'ليا', 'نوع', 'واحد',
  // English
  'i', 'want', 'need', 'looking', 'for', 'a', 'an', 'the', 'some', 'good', 'cheap', 'cheapest', 'price',
  'quality', 'buy', 'find', 'me', 'please', 'with', 'under', 'below', 'best', 'any', 'pi', 'and', 'or',
  'recommend', 'suggest', 'where', 'can', 'get', 'you', 'is', 'there', 'have', 'do',
]);

const normalize = (s: string) => s
  .toLowerCase()
  .replace(/[ـ]/g, '')
  .replace(/[ً-ْ]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي');

/** The product words of an ask: at most 5, each 2–40 characters, no stop words, no numbers. */
export function productTerms(ask: string): string[] {
  const out: string[] = [];
  for (const raw of normalize(ask ?? '').split(/[^\p{L}\p{N}]+/u)) {
    const w = raw.trim();
    if (w.length < 2 || w.length > 40 || STOP.has(w) || /^\d+$/.test(w)) continue;
    if (!out.includes(w)) out.push(w);
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Is this ask about finding something to buy?
 *
 * Deliberately NOT the intent observation's objective: that one is an instrument
 * (lib/ai/intent-observation.ts — "nothing reads this to decide anything"), and an
 * instrument that starts steering answers stops being a measurement. This detector is
 * narrow on purpose: a strong buying word, or "I want/need …" that is not about an app,
 * a goal or sending Pi. A miss costs a pointer to the shop; a false hit costs a wasted
 * search the prompt tells the model to ignore.
 */
// 2026-10-08, owner's phone: "a good charger" asked as a recommendation or with "عندك"
// matched nothing here, so no search ran and TEC AI said the catalogue was not in front
// of it. Recommendation and availability words now count as asking for a product.
const BUY_STRONG = /(اشتري|اشتريت|ادور علي|بدور علي|عندكم|عندك|متوفر|بكام|ابحث|دورلي|دور لي|لاقيلي|تلاقيلي|الاقي|هاتلي|رشح|انصحني|اقترح|احسن|\bbuy\b|looking for|shop for|do you have|price of|ارخص|cheapest|recommend|suggest|where can i get|\bbest\b)/;
const WANT       = /(عاوز|عايز|محتاج|ابغي|اريد|\bi want\b|\bi need\b|\bneed a\b|\bwant a\b)/;
const NOT_A_PRODUCT = /(تطبيق|ابدا|اعرف|افهم|اوفر|ادخر|هدف|اهداف|ابعت|احول|اوثق|اشتراك|\bapp\b|\bsave\b|\bgoal|\bsend\b|\bstart\b|\bverify|\bsubscri)/;

export function isProductAsk(ask: string): boolean {
  const h = normalize(ask ?? '');
  if (!h.trim() || NOT_A_PRODUCT.test(h)) return false;
  return (BUY_STRONG.test(h) || WANT.test(h)) && productTerms(ask).length > 0;
}

/**
 * The same thing in the other language. Sellers on a Pi marketplace often title in
 * English; people ask in Arabic. "شاحن" found nothing while a "Charger" may have been
 * listed (owner's phone, 2026-10-08). A short, closed list of everyday goods — not a
 * translator — keyed by the normalized word (ة→ه).
 */
const ALSO: Record<string, string[]> = {
  'شاحن': ['charger'], 'charger': ['شاحن'],
  'سماعه': ['headphones', 'earbuds'], 'سماعات': ['headphones', 'earbuds'], 'headphones': ['سماعه'], 'earbuds': ['سماعه'],
  'موبايل': ['phone'], 'تليفون': ['phone'], 'جوال': ['phone'], 'هاتف': ['phone'], 'phone': ['موبايل'],
  'كابل': ['cable'], 'cable': ['كابل'], 'جراب': ['case', 'cover'],
  'ساعه': ['watch'], 'watch': ['ساعه'], 'لابتوب': ['laptop'], 'laptop': ['لابتوب'],
  'باور': ['power', 'powerbank'], 'بنك': ['bank'], 'شنطه': ['bag'], 'bag': ['شنطه'],
  'كتاب': ['book'], 'book': ['كتاب'], 'تيشيرت': ['shirt', 't-shirt'], 'قميص': ['shirt'], 'جزمه': ['shoes'], 'حذاء': ['shoes'],
};

/** The words actually sent and matched: the person's own first, then their counterparts — at most six (commerce-service's cap). */
export function searchTerms(terms: string[]): string[] {
  const out = [...terms];
  for (const t of terms) for (const a of ALSO[t] ?? []) if (!out.includes(a)) out.push(a);
  return out.slice(0, 6);
}

export interface FoundProduct {
  id:      string;
  title:   string;
  price:   string | null;   // as the service stated it; null when absent — never 0
  inStock: boolean | null;
  url:     string;
}

export type ProductSearch =
  | { status: 'found';       terms: string[]; products: FoundProduct[] }
  | { status: 'none';        terms: string[] }
  | { status: 'unavailable'; terms: string[] };

/** Rank by how many of the words the title (then the description) contains; drop zero. */
export function rankProducts(rows: unknown[], terms: string[]): FoundProduct[] {
  const scored: { p: FoundProduct; score: number }[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const o = (r ?? {}) as Record<string, unknown>;
    const id    = typeof o.id === 'string' ? o.id : '';
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    if (!id || !title) continue;
    const t = normalize(title);
    const d = normalize(typeof o.description === 'string' ? o.description : '');
    const score = terms.reduce((n, w) => n + (t.includes(w) ? 2 : d.includes(w) ? 1 : 0), 0);
    if (score === 0) continue;
    const price = typeof o.price === 'number' || (typeof o.price === 'string' && o.price.trim() !== '')
      ? String(o.price) : null;
    const stock = typeof o.stock === 'number' ? o.stock > 0 : null;
    scored.push({ p: { id, title: title.slice(0, 120), price, inStock: stock, url: `${ECOMMERCE_ORIGIN}/product/${encodeURIComponent(id)}` }, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, SHOW).map((s) => s.p);
}

export async function searchProducts(
  gateway: string,
  ask: string,
  opts: { maxPrice?: number | null; internalKey?: string } = {},
): Promise<ProductSearch | null> {
  const terms = productTerms(ask);
  if (!terms.length) return null;               // nothing to search for — say nothing
  const words = searchTerms(terms);
  const qs = new URLSearchParams({ q: words.join(' '), limit: '20' });
  if (opts.maxPrice && opts.maxPrice > 0) qs.set('max_price', String(opts.maxPrice));
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${gateway.replace(/\/$/, '')}/api/commerce/products?${qs}`, {
      headers: { ...(opts.internalKey ? { 'x-internal-key': opts.internalKey } : {}) },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { status: 'unavailable', terms };
    const body = await res.json().catch(() => null) as { data?: { products?: unknown[] }; products?: unknown[] } | null;
    const products = rankProducts(body?.data?.products ?? body?.products ?? [], words);
    return products.length ? { status: 'found', terms, products } : { status: 'none', terms };
  } catch {
    return { status: 'unavailable', terms };
  }
}

/** The prompt section. The model may only repeat what is here. */
export function productSection(s: ProductSearch): string {
  const words = s.terms.join(' ');
  if (s.status === 'unavailable') {
    return `## PRODUCT SEARCH\nYou tried to search TEC's marketplace for «${words}» and the search did not answer. Say you could not search just now and point to the shop; never invent a product.`;
  }
  if (s.status === 'none') {
    return `## PRODUCT SEARCH\nYou searched TEC's marketplace for «${words}»: NOTHING listed matches. Say so plainly — no product of that kind is listed yet — and offer the shop or a different word. Never invent a product, a price or a seller. (If the person was not actually asking for a product, ignore this section.)`;
  }
  const lines = s.products.map((p) =>
    `- ${p.title} — ${p.price ?? '—'} π — ${p.inStock === null ? 'stock unknown' : p.inStock ? 'in stock' : 'OUT OF STOCK'} — ${p.url}`);
  return `## PRODUCTS FOUND (live, just searched TEC's marketplace for «${words}»)
Recommend ONLY from this list, with each product's link exactly as written. Say the price as listed;
say "out of stock" where it is. You cannot judge quality you were not told — never claim one is
better made. The person opens the link and buys there themselves.
${lines.join('\n')}`;
}
