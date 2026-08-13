'use client';

import { useEffect } from 'react';
import { captureUtm } from '@/lib-client/campaign';

/**
 * Global, render-nothing capture of an incoming `?utm_*` from an ad/campaign link.
 * Mounted once at the client boundary (next to RefCapture) so it runs on EVERY page
 * — public landing, /pioneers, anywhere — before the visitor has even logged in.
 * First-touch: the original source is preserved and later attached to the Pioneer
 * record, so the pilot can attribute qualified Pioneers to the channel/creative that
 * brought them (not just count clicks). Reads window.location.search directly
 * (no useSearchParams → no Suspense boundary needed).
 */
export function UtmCapture() {
  useEffect(() => {
    captureUtm(window.location.search);
  }, []);
  return null;
}
