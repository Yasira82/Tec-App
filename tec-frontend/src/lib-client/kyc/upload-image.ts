'use client';

// KYC document photo upload. The browser sends the file to a SAME-ORIGIN BFF
// route which server-proxies it to secure storage (R2) — the browser never
// PUTs to R2 directly, so there is no cross-origin/CORS failure. We persist the
// returned `key` (a durable reference) on the KYC record; the file itself stays
// in private storage.

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

export interface UploadedImage {
  key:  string; // durable storage reference persisted on the KYC record
  name: string; // original filename (for display)
}

export async function uploadKycImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/bff/storage/upload', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'x-csrf-token': getCsrfToken() }, // do NOT set Content-Type — the browser sets the multipart boundary
    body:        form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? 'Upload failed. Please try again.');
  }
  const key: string | undefined = data?.data?.key ?? data?.key;
  if (!key) throw new Error('Upload did not complete. Please try again.');

  return { key, name: file.name };
}
