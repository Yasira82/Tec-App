/**
 * OpenRouter's FREE models, read from OpenRouter itself (2026-10-08).
 *
 * The first production health check showed why a hardcoded list cannot work here: all
 * four `:free` ids written from research the same day answered 404 "This model is
 * unavailable for free. The paid version is available now". OpenRouter's free roster
 * moves weekly. So the candidates come from its public catalogue
 * (`GET /api/v1/models`, no key needed): ids ending in `:free` whose prompt AND
 * completion price are both exactly zero, text in, text out.
 *
 * Order: GPT first (the owner asked for GPT), then the larger context window. Cached
 * per edge instance for an hour; a failed read falls back to the last good list, then
 * to nothing — OpenRouter is the third free provider, so an empty list only means the
 * walk moves on.
 */

const CATALOGUE  = 'https://openrouter.ai/api/v1/models';
const TTL_MS     = 60 * 60 * 1000;
const TIMEOUT_MS = 1500;
const MAX        = 4;

let cached: { at: number; ids: string[] } | null = null;

const isZero = (v: unknown) => v === 0 || v === '0' || (typeof v === 'string' && Number(v) === 0 && v.trim() !== '');

/** Pure — pick and order the free text models from a catalogue payload. */
export function pickFreeModels(payload: unknown): string[] {
  const rows = (payload as { data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];
  const free = rows
    .map((r) => (r ?? {}) as {
      id?: unknown;
      context_length?: unknown;
      pricing?: { prompt?: unknown; completion?: unknown };
      architecture?: { input_modalities?: unknown; output_modalities?: unknown };
    })
    .filter((r) => typeof r.id === 'string' && r.id.endsWith(':free'))
    .filter((r) => isZero(r.pricing?.prompt) && isZero(r.pricing?.completion))
    .filter((r) => {
      const inp = r.architecture?.input_modalities;
      const out = r.architecture?.output_modalities;
      const textIn  = !Array.isArray(inp) || inp.includes('text');
      const textOut = !Array.isArray(out) || (out.includes('text') && out.length === 1);
      return textIn && textOut;
    });
  const gpt = (id: string) => (/(^|\/)(gpt|openai\/)/i.test(id) || id.startsWith('openai/') ? 0 : 1);
  return free
    .sort((a, b) => gpt(a.id as string) - gpt(b.id as string)
      || (Number(b.context_length) || 0) - (Number(a.context_length) || 0))
    .slice(0, MAX)
    .map((r) => r.id as string);
}

export async function freeOpenRouterModels(now = Date.now()): Promise<string[]> {
  if (cached && now - cached.at < TTL_MS) return cached.ids;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(CATALOGUE, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (res.ok) {
      const ids = pickFreeModels(await res.json());
      if (ids.length) { cached = { at: now, ids }; return ids; }
    }
  } catch { /* fall through */ }
  return cached?.ids ?? [];
}

/** Test-only. */
export function __resetFreeModels(): void { cached = null; }
