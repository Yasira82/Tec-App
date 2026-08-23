import './globals.css';
// The token layer belongs at the root, not per-section. It was imported by
// /hub and /dashboard only, so a SHARED component styled with `var(--tec-*)`
// rendered correctly inside the Hub and colourless on /ai — the variable simply
// did not exist on that page. The file is additive (custom properties, keyframes,
// utility classes); defining it once removes that class of bug entirely.
import '@/styles/tec-design-tokens.css';
import Script from 'next/script';
import { THEME_BOOT_SCRIPT } from '@/lib-client/theme';
import localFont from 'next/font/local';
import { ClientProviders } from '@/components/ClientProviders';
import PiSdkLoader from '@/components/PiSdkLoader';
import { BackendOfflineBanner } from '@/components/BackendOfflineBanner';
import { PlatformHealthProvider } from '@/context/PlatformHealthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PiBrowserGuard from '@/components/PiBrowserGuard';
import type { Metadata, Viewport } from 'next';

// ✅ منع prerender لكل الصفحات

// Self-hosted (next/font/local) so `next build` never fetches from fonts.gstatic.com
// — a transient Google Fonts fetch used to fail the build (CI flake). Variable woff2
// (latin), one file per style covering the full weight range. Same CSS variables +
// swap as before, so the visual result is unchanged.
const cormorantGaramond = localFont({
  src: [
    { path: './fonts/cormorant-normal.woff2', weight: '300 600', style: 'normal' },
    { path: './fonts/cormorant-italic.woff2', weight: '300 600', style: 'italic' },
  ],
  variable: '--font-cormorant',
  display:  'swap',
});

const dmSans = localFont({
  src: [
    { path: './fonts/dmsans.woff2', weight: '300 500', style: 'normal' },
  ],
  variable: '--font-dm-sans',
  display:  'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tec-app-frontend.vercel.app';

export const viewport: Viewport = {
  width:            'device-width',
  initialScale:     1,
  maximumScale:     1,
  userScalable:     false,
  viewportFit:      'cover',
  themeColor:       '#F8B820',
};

export const metadata: Metadata = {
  title: {
    default:  'TEC — The Elite Consortium',
    template: '%s | TEC',
  },
  description: 'A complete ecosystem of 24 sovereign apps built on Pi Network. One identity. One wallet. One world.',
  keywords:    ['TEC', 'The Elite Consortium', 'Pi Network', 'Pi', 'crypto', 'blockchain', 'ecosystem', '24 apps'],
  authors:     [{ name: 'The Elite Consortium', url: APP_URL }],
  creator:     'The Elite Consortium',
  publisher:   'The Elite Consortium',
  metadataBase: new URL(APP_URL),
  manifest:    '/manifest.json',

  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'TEC',
  },

  openGraph: {
    type:        'website',
    url:         APP_URL,
    siteName:    'TEC — The Elite Consortium',
    title:       'TEC — The Elite Consortium',
    description: 'A complete ecosystem of 24 sovereign apps built on Pi Network. One identity. One wallet. One world.',
    images: [{
      url:    '/og-image.png',
      width:  1200,
      height: 630,
      alt:    'TEC — The Elite Consortium',
    }],
    locale: 'en_US',
  },

  twitter: {
    card:        'summary_large_image',
    title:       'TEC — The Elite Consortium',
    description: 'A complete ecosystem of 24 sovereign apps built on Pi Network.',
    images:      ['/og-image.png'],
  },

  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:  true,
      follow: true,
      'max-image-preview': 'large',
    },
  },

  icons: {
    icon:  '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

const piSandbox     = process.env.NEXT_PUBLIC_PI_SANDBOX !== 'false';
const sdkTimeoutEnv = process.env.NEXT_PUBLIC_PI_SDK_TIMEOUT
  ? parseInt(process.env.NEXT_PUBLIC_PI_SDK_TIMEOUT, 10)
  : 25000;
const sdkTimeout = sdkTimeoutEnv > 0 && sdkTimeoutEnv < 120000 ? sdkTimeoutEnv : 25000;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* `suppressHydrationWarning`: the boot script below stamps `data-theme` on
       this element before React hydrates, so the server markup and the client
       DOM differ here on purpose. */
    <html lang="en" dir="ltr" className={`${cormorantGaramond.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the stored theme BEFORE first paint. Without it the page
            renders dark, then snaps to light — a flash on every single load,
            which is worse than not offering the choice at all. Inline and
            synchronous by necessity: anything deferred paints too late. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />
        <PiSdkLoader sandbox={piSandbox} timeout={sdkTimeout} />
        <PlatformHealthProvider>
          <BackendOfflineBanner />
          <ClientProviders>
            <ErrorBoundary>
              <PiBrowserGuard>
                {children}
              </PiBrowserGuard>
            </ErrorBoundary>
          </ClientProviders>
        </PlatformHealthProvider>
      </body>
    </html>
  );
}
