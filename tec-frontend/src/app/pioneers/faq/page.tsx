import type { Metadata } from 'next';
import { LIVE_DOMAINS } from '@/domains/_registry';
import FaqClient from './FaqClient';

// Public Pioneer FAQ + Trust page. Not in middleware PROTECTED_ROUTES — open to
// everyone. App count derived from the LIVE registry so the copy never drifts.
const TITLE = 'Pioneer FAQ — TEC Founding 100';
const DESCRIPTION = `Answers for new Pi users joining TEC: what it is, why you log in with Pi, is it safe, do you pay, and how the Founding 100 works. ${LIVE_DOMAINS.length} apps live on Pi Mainnet.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/pioneers/faq' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/pioneers/faq', siteName: 'TEC', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

// FAQPage structured data (schema.org) — professional SEO so search + social
// surface the questions directly. Kept in English (canonical) and honest.
const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    ['What is TEC?', `A full economy built on Pi — ${LIVE_DOMAINS.length} apps sharing one identity and one wallet, with real Pi payments.`],
    ['What is a Founding Pioneer?', 'The first 100 Pioneers to complete the Quest earn a permanent Founding Pioneer badge in their TEC reputation. It is earned, never bought.'],
    ['Do I have to pay anything?', 'No. The Founding badge is earned by completing the Quest — opening every live app — with no payment required.'],
    ['Do I need KYC?', 'Pi Network handles KYC itself for wallet, payments and domain claims. You do not complete a separate TEC KYC to be a Pioneer.'],
    ['Is it safe? What data do you store?', 'Your session lives in secure HttpOnly cookies, never in localStorage. TEC does not store your Pi wallet keys or Pi-Network KYC.'],
    ['Are the numbers real?', 'Always. TEC never shows a fabricated counter — if zero Pioneers have joined, it shows zero. Every number is real server data.'],
  ].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};

export default function PioneerFaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
      <FaqClient />
    </>
  );
}
