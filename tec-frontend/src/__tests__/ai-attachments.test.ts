/**
 * Photos and PDFs in TEC AI (owner, 2026-10-08): nothing stored, a closed set, only
 * models that can see, 10 a day — and Claude moved off a retired model id.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseAttachments, claudeContent, geminiParts, attachmentNote, MAX_TOTAL_B64,
} from '@/lib/ai/attachments';
import { checkAttachmentAllowance, __resetAttachmentAllowance } from '@/lib/ai/rate-limit';
import { prepareAttachment, toPayload, attachmentLine, PDF_MAX_BYTES } from '@/lib-client/ai/attachments';

const route = readFileSync(join(process.cwd(), 'src/app/api/ai/chat/route.ts'), 'utf8');
const img = { mediaType: 'image/jpeg', data: 'QUJD' };
const pdf = { mediaType: 'application/pdf', data: 'JVBERi0=' };

describe('the server accepts a closed, bounded set', () => {
  it('no attachments is fine', () => {
    expect(parseAttachments(undefined)).toEqual({ ok: true, attachments: [] });
  });

  it('photos and PDFs, up to three', () => {
    const r = parseAttachments([img, pdf, img]);
    expect(r.ok && r.attachments.map(a => a.kind)).toEqual(['image', 'pdf', 'image']);
  });

  it.each([
    ['four files', [img, img, img, img]],
    ['an unknown type', [{ mediaType: 'image/gif', data: 'QUJD' }]],
    ['a data: URL instead of base64', [{ mediaType: 'image/jpeg', data: 'data:image/jpeg;base64,QUJD' }]],
    ['not an array', { mediaType: 'image/jpeg', data: 'QUJD' }],
    ['over the size budget', [{ mediaType: 'image/jpeg', data: 'A'.repeat(MAX_TOTAL_B64 + 4) }]],
  ])('refuses %s', (_label, raw) => {
    expect(parseAttachments(raw)).toEqual({ ok: false, code: 'ATTACH_INVALID' });
  });
});

describe('each model gets its own shape', () => {
  it('Claude: files before the words, PDFs as documents', () => {
    const r = parseAttachments([pdf, img]);
    const c = claudeContent('what is this?', r.ok ? r.attachments : []) as Array<{ type: string }>;
    expect(c.map(b => b.type)).toEqual(['document', 'image', 'text']);
  });

  it('Gemini: inline data, then the text', () => {
    const r = parseAttachments([img]);
    expect(geminiParts('hi', r.ok ? r.attachments : [])).toEqual([
      { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } }, { text: 'hi' },
    ]);
  });

  it('the model is told never to repeat a full ID number, and that nothing is kept', () => {
    const r = parseAttachments([img]);
    const note = attachmentNote(r.ok ? r.attachments : []);
    expect(note).toMatch(/Never repeat a full ID, card, account or passport\s+number/);
    expect(note).toMatch(/TEC keeps no copy/);
    expect(attachmentNote([])).toBe('');
  });
});

describe('the route', () => {
  it('never sends an attachment to the text-only Groq models', () => {
    expect(route).toMatch(/\['groq',\s+attachments\.length \? undefined : groqKey/);
  });

  it('says so when no seeing model is configured, instead of answering blind', () => {
    expect(route).toMatch(/code: 'ATTACH_UNSUPPORTED'/);
  });

  it('checks the daily allowance before calling any model', () => {
    expect(route.indexOf('checkAttachmentAllowance(')).toBeLessThan(route.indexOf('const providers'));
  });

  it('stores nothing: no storage service, no attachment in the intent observation', () => {
    expect(route).not.toMatch(/api\/storage/);
    expect(route).not.toMatch(/recordIntentObservation\([^)]*attachments/);
  });

  it('Claude leads with a current model; the retired id is last', () => {
    expect(route).toMatch(/'claude-opus-5-5',\s*\n\s*'claude-3-5-sonnet-20240620'/);
    expect(route).toMatch(/fallbacks: 'default'/);
  });
});

describe('10 attachments a day per person', () => {
  beforeEach(() => __resetAttachmentAllowance());

  it('counts attachments, not messages', async () => {
    expect((await checkAttachmentAllowance('u1', 3, 10)).ok).toBe(true);
    expect((await checkAttachmentAllowance('u1', 3, 10)).ok).toBe(true);
    expect((await checkAttachmentAllowance('u1', 3, 10)).ok).toBe(true);
    expect((await checkAttachmentAllowance('u1', 3, 10)).ok).toBe(false);   // 12 > 10
    expect((await checkAttachmentAllowance('u1', 1, 10)).ok).toBe(true);    // exactly 10
  });

  it('is per person', async () => {
    await checkAttachmentAllowance('u1', 10, 10);
    expect((await checkAttachmentAllowance('u2', 1, 10)).ok).toBe(true);
  });
});

describe('the phone prepares what it sends', () => {
  it('refuses a type the models cannot read', async () => {
    expect(await prepareAttachment(new File(['x'], 'a.zip', { type: 'application/zip' }))).toBe('type');
  });

  it('refuses a PDF over the cap — PDFs cannot be shrunk in the browser', async () => {
    const big = new File([new Uint8Array(PDF_MAX_BYTES + 1)], 'big.pdf', { type: 'application/pdf' });
    expect(await prepareAttachment(big)).toBe('too_big');
  });

  it('reads a small PDF as base64', async () => {
    const r = await prepareAttachment(new File(['%PDF-'], 'a.pdf', { type: 'application/pdf' }));
    expect(typeof r === 'object' && r.kind).toBe('pdf');
    expect(typeof r === 'object' && r.data).toBe('JVBERi0=');
  });

  it('sends only the type and the data; the name and thumbnail stay on the phone', () => {
    const p = toPayload([{ kind: 'image', mediaType: 'image/jpeg', data: 'QUJD', name: 'id-card.jpg', thumb: 'data:x' }]);
    expect(p).toEqual([{ mediaType: 'image/jpeg', data: 'QUJD' }]);
    expect(attachmentLine([{ kind: 'pdf', mediaType: 'application/pdf', data: 'x', name: 'bill.pdf' }])).toBe('📎 bill.pdf');
  });
});

describe('2026-10-09 — three screenshots, "temporarily unavailable", then "I can\'t view images"', () => {
  const prompt = readFileSync(join(process.cwd(), 'src/lib/ai/tec-ai-system-prompt.ts'), 'utf8');
  const health = readFileSync(join(process.cwd(), 'src/app/api/ai/health/route.ts'), 'utf8');

  it('a 📎 line in an earlier message is named for what it is: files no longer here, attach again', () => {
    expect(prompt).toMatch(/A\s+line in an EARLIER message that starts with 📎/);
    expect(prompt).toMatch(/ask the person to attach them again with the question/);
    expect(prompt).toMatch(/Never claim you cannot read images/);
  });

  it('/api/ai/health?images=1 sends Gemini a real image the way the chat does, and times the first bytes', () => {
    expect(health).toMatch(/searchParams\.get\('images'\) === '1'; \} catch/);
    expect(health).toMatch(/inline_data: \{ mime_type: 'image\/png', data: PROBE_IMAGE \}/);
    expect(health).toMatch(/system_instruction: \{ parts: \[\{ text: TEC_SYSTEM_PROMPT \}\] \}/);
    expect(health).toMatch(/streamGenerateContent\?alt=sse/);
    expect(health).toMatch(/budgetMs: 20_000/);
  });
});
