/**
 * OpenRouter's free models are read from its catalogue (lib/ai/openrouter-free.ts) —
 * the hardcoded :free ids all died the day they shipped (production health, 2026-10-08).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { pickFreeModels, freeOpenRouterModels, __resetFreeModels } from '@/lib/ai/openrouter-free';

const row = (id: string, prompt: string, completion: string, ctx = 8000, inp = ['text'], out = ['text']) =>
  ({ id, context_length: ctx, pricing: { prompt, completion }, architecture: { input_modalities: inp, output_modalities: out } });

describe('picking the free models', () => {
  it('keeps only :free ids priced at exactly zero, text in and text out', () => {
    const ids = pickFreeModels({ data: [
      row('qwen/qwen3-32b:free', '0', '0', 32000),
      row('openai/gpt-oss-120b', '0.0000001', '0.0000004'),            // paid
      row('meta/llama-x:free', '0.0000001', '0'),                       // :free in name, not price
      row('black-forest/flux:free', '0', '0', 8000, ['text'], ['image']), // makes images
      row('z-ai/glm-4.5-air:free', '0', '0', 128000),
    ] });
    expect(ids).toEqual(['z-ai/glm-4.5-air:free', 'qwen/qwen3-32b:free']);
  });

  it('puts GPT first, then the larger context', () => {
    const ids = pickFreeModels({ data: [
      row('qwen/big:free', '0', '0', 200000),
      row('openai/gpt-oss-20b:free', '0', '0', 8000),
    ] });
    expect(ids[0]).toBe('openai/gpt-oss-20b:free');
  });

  it('caps the list at four and survives garbage', () => {
    expect(pickFreeModels({ data: Array.from({ length: 9 }, (_, i) => row(`x/m${i}:free`, '0', '0')) })).toHaveLength(4);
    expect(pickFreeModels(null)).toEqual([]);
    expect(pickFreeModels({ data: 'nope' })).toEqual([]);
  });
});

describe('reading the catalogue', () => {
  beforeEach(() => __resetFreeModels());
  afterEach(() => vi.unstubAllGlobals());

  it('caches for an hour, and keeps the last good list when a read fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [row('a/b:free', '0', '0')] }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await freeOpenRouterModels(1_000)).toEqual(['a/b:free']);
    expect(await freeOpenRouterModels(2_000)).toEqual(['a/b:free']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await freeOpenRouterModels(1_000 + 2 * 60 * 60 * 1000)).toEqual(['a/b:free']);
  });

  it('an unreachable catalogue with nothing cached is an empty list — the walk moves on', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await freeOpenRouterModels()).toEqual([]);
  });
});
