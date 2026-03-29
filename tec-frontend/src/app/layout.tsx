import './globals.css';
import Script from 'next/script';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import { ClientProviders } from '@/components/ClientProviders';
import PiSdkLoader from '@/components/PiSdkLoader';
import { BackendOfflineBanner } from '@/components/BackendOfflineBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PiBrowserGuard from '@/components/PiBrowserGuard';
import type { Metadata, Viewport } from 'next';

const cormorantGaramond = Cormorant_Garamond({
  subsets:  ['latin'],
  weight:   ['300', '400', '600'],
  style:    ['normal', 'italic'],
  variable: '--font-cormorant',
  display:  'swap',
});

const dmSans = DM_Sans({
  subsets:  ['latin'],
  weight:   ['300', '400', '500'],
  variable: '--font-dm-sans',
  display:  'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tec-app.vercel.app';

export const viewport: Viewport = {
  width:            'device-width',
  initialScale:     1,
  maximumScale:     1,
  userScalable:     false,
  viewportFit:      'cover',
  themeColor:       '#d4af37',
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
    <html lang="en" dir="ltr" className={`${cormorantGaramond.variable} ${dmSans.variable}`}>
      <body>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />
        <PiSdkLoader sandbox={piSandbox} timeout={sdkTimeout} />
        <BackendOfflineBanner />
        <ClientProviders>
          <ErrorBoundary>
            <PiBrowserGuard>
              {children}
            </PiBrowserGuard>
          </ErrorBoundary>
        </ClientProviders>
      </body>
    </html>
  );
}
