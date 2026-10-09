'use client';

/**
 * Preparing a photo or PDF for TEC AI, on the phone (server rules: lib/ai/attachments.ts).
 *
 * Photos are SHRUNK here — a phone photo is 3–8 MB and the request must fit Vercel's
 * ~4.5 MB limit with everything else in it. 1600 px on the long side at JPEG 0.82 keeps
 * text on a receipt readable and lands around 200–500 KB. PDFs cannot be shrunk in the
 * browser, so they are capped instead.
 *
 * Nothing here uploads anything: the result is base64 that rides in the chat request.
 */

export const MAX_FILES     = 6;   // owner, 2026-10-09: "more than 3"
export const PDF_MAX_BYTES = 3 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1600;
const JPEG_QUALITY   = 0.82;
const THUMB_SIDE     = 96;

export interface PreparedAttachment {
  kind:      'image' | 'pdf';
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  data:      string;          // base64, no prefix
  name:      string;
  thumb?:    string;          // a small data: URL for the composer chip (images only)
}

export type PrepareError = 'type' | 'too_big' | 'unreadable';

const IMAGE_IN = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
    return img;
  } finally {
    // Revoked after decode — the pixels live in the element now.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function draw(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale  = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function prepareAttachment(file: File): Promise<PreparedAttachment | PrepareError> {
  if (file.type === 'application/pdf') {
    if (file.size > PDF_MAX_BYTES) return 'too_big';
    try {
      return { kind: 'pdf', mediaType: 'application/pdf', data: await fileToBase64(file), name: file.name || 'document.pdf' };
    } catch { return 'unreadable'; }
  }
  if (!IMAGE_IN.test(file.type)) return 'type';
  try {
    // Every photo is re-encoded as JPEG: it shrinks it, and it turns HEIC (iPhone) into
    // something the models read — and it drops the photo's EXIF, location included.
    const img  = await loadImage(file);
    const full = draw(img, IMAGE_MAX_SIDE).toDataURL('image/jpeg', JPEG_QUALITY);
    const thumb = draw(img, THUMB_SIDE).toDataURL('image/jpeg', 0.7);
    return { kind: 'image', mediaType: 'image/jpeg', data: full.replace(/^data:[^,]*,/, ''), name: file.name || 'photo.jpg', thumb };
  } catch {
    return 'unreadable';
  }
}

/** Together they must fit one request (the server's MAX_TOTAL_B64). */
export const MAX_TOTAL_B64 = 4_000_000;
export const totalSize = (atts: PreparedAttachment[]) => atts.reduce((n, a) => n + a.data.length, 0);

/** Drop the 📎 line a message carries for the model; the bubble shows thumbnails instead. */
export const withoutAttachLine = (text: string) => text.replace(/^📎[^\n]*\n?/, '');

/** The request payload — the name and thumbnail stay on the phone. */
export const toPayload = (atts: PreparedAttachment[]) =>
  atts.map(({ mediaType, data }) => ({ mediaType, data }));

/** One line for the transcript, so the conversation shows what was sent. */
/**
 * Which files these are — so a set that stays attached across messages is shown in the
 * transcript once, not under every question (owner, 2026-10-09: "attach once").
 */
export const attachmentKey = (atts: PreparedAttachment[]) =>
  atts.map(a => `${a.name}:${a.data.length}`).join('|');

export const attachmentLine = (atts: PreparedAttachment[]) =>
  atts.length ? `📎 ${atts.map(a => a.name).join(' · ')}` : '';
