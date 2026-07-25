'use client';

import { LocaleProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ToastProvider';
import { RefCapture } from '@/components/referral/RefCapture';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ToastProvider>
        {/* Capture an invite ?ref= on every page, before login */}
        <RefCapture />
        {children}
      </ToastProvider>
    </LocaleProvider>
  );
}
