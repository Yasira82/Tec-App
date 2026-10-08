/**
 * TEC AI attachments — photos and PDFs sent with ONE message (owner, 2026-10-08).
 *
 * The decisions this file encodes:
 *  1. **Nothing is stored.** An attachment rides in the request body to the model and is
 *     gone: no copy in tec-storage-service, none in the logs, none in the intent
 *     observation. People will photograph ID cards and invoices; the safest copy of those
 *     is the one that does not exist. The phone keeps its own thumbnail in the chat.
 *  2. **Closed and bounded.** JPEG / PNG / WebP / PDF only, at most 3 per message, and a
 *     total that fits Vercel's request limit (the client shrinks photos first).
 *  3. **Only models that can see.** Claude and Gemini read images and PDFs; the Groq
 *     models in the candidate list read text only, so a message with an attachment never
 *     goes there. If no seeing model is configured the person is told, never answered as
 *     if the picture had been read.
 *  4. **10 a day per person** — attachments cost far more than text (rate-limit.ts).
 */

export const MAX_ATTACHMENTS    = 3;
/** Base64 characters across all attachments — under Vercel's ~4.5 MB body limit with room for the rest. */
export const MAX_TOTAL_B64      = 4_000_000;
export const ATTACHMENTS_PER_DAY = 10;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PDF_TYPE    = 'application/pdf';

export interface Attachment {
  kind:      'image' | 'pdf';
  mediaType: (typeof IMAGE_TYPES)[number] | typeof PDF_TYPE;
  /** Base64, no data: prefix, no whitespace. */
  data:      string;
}

export type AttachmentParse =
  | { ok: true;  attachments: Attachment[] }
  | { ok: false; code: 'ATTACH_INVALID' };

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Narrow what the body claims. Anything off the closed set refuses the whole message. */
export function parseAttachments(raw: unknown): AttachmentParse {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) return { ok: false, code: 'ATTACH_INVALID' };

  const out: Attachment[] = [];
  let total = 0;
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const mediaType = o.mediaType;
    const data      = o.data;
    if (typeof data !== 'string' || !data || !B64.test(data)) return { ok: false, code: 'ATTACH_INVALID' };
    total += data.length;
    if (mediaType === PDF_TYPE) out.push({ kind: 'pdf', mediaType: PDF_TYPE, data });
    else if ((IMAGE_TYPES as readonly unknown[]).includes(mediaType)) {
      out.push({ kind: 'image', mediaType: mediaType as Attachment['mediaType'], data });
    } else return { ok: false, code: 'ATTACH_INVALID' };
  }
  if (total > MAX_TOTAL_B64) return { ok: false, code: 'ATTACH_INVALID' };
  return { ok: true, attachments: out };
}

/** Claude content for the LAST user turn: the files first, then the words (the API's recommended order). */
export function claudeContent(text: string, atts: Attachment[]): unknown[] {
  return [
    ...atts.map((a) => a.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: a.mediaType, data: a.data } }
      : { type: 'image',    source: { type: 'base64', media_type: a.mediaType, data: a.data } }),
    { type: 'text', text },
  ];
}

/** Gemini parts for the LAST user turn. */
export function geminiParts(text: string, atts: Attachment[]): unknown[] {
  return [
    ...atts.map((a) => ({ inline_data: { mime_type: a.mediaType, data: a.data } })),
    { text },
  ];
}

/** What the model is told — and the one privacy rule that matters here. */
export function attachmentNote(atts: Attachment[]): string {
  if (!atts.length) return '';
  const images = atts.filter((a) => a.kind === 'image').length;
  const pdfs   = atts.length - images;
  const what = [images ? `${images} photo(s)` : '', pdfs ? `${pdfs} PDF(s)` : ''].filter(Boolean).join(' and ');
  return `## ATTACHMENTS
The person attached ${what} to their last message. Describe and explain only what you can actually
see in them; if something is unreadable, say so. Never repeat a full ID, card, account or passport
number from an attachment — at most the last 4 characters. TEC keeps no copy of the attachment.`;
}
