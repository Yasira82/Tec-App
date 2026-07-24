'use client';

// Two-step secure upload for KYC document photos:
//   1. ask the BFF for a short-lived presigned upload URL (tec-storage-service),
//   2. PUT the file bytes straight to storage (R2) — the image never touches
//      the Hub server. We persist the returned `key` (a durable reference) on
//      the KYC record; the file itself stays in private storage.

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

export interface UploadedImage {
  key:  string; // durable storage reference persisted on the KYC record
  name: string; // original filename (for display)
}

export async function uploadKycImage(file: File): Promise<UploadedImage> {
  // 1) presigned URL
  const urlRes = await fetch('/api/bff/storage/upload-url', {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
    body:        JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size, folder: 'kyc' }),
  });
  const urlData = await urlRes.json().catch(() => ({}));
  if (!urlRes.ok) {
    throw new Error(urlData?.error ?? 'Could not start the upload. Please try again.');
  }
  const uploadUrl: string | undefined = urlData?.data?.uploadUrl ?? urlData?.uploadUrl;
  const key:       string | undefined = urlData?.data?.key       ?? urlData?.key;
  if (!uploadUrl || !key) {
    throw new Error('Upload service is unavailable. Please try again later.');
  }

  // 2) PUT the bytes directly to storage
  const putRes = await fetch(uploadUrl, {
    method:  'PUT',
    headers: { 'Content-Type': file.type },
    body:    file,
  });
  if (!putRes.ok) {
    throw new Error('Upload failed. Please check your connection and try again.');
  }

  return { key, name: file.name };
}
