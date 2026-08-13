'use client';

import { LocaleProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ToastProvider';
import { RefCapture } from '@/components/referral/RefCapture';
import { UtmCapture } from '@/components/campaign/UtmCapture';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ToastProvider>
        {/* Capture an invite ?ref= and campaign ?utm_* on every page, before login */}
        <RefCapture />
        <UtmCapture />
        {children}
      </ToastProvider>
    </LocaleProvider>
  );
}
