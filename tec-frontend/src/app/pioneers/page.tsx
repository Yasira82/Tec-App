import type { Metadata } from 'next';
import { LIVE_DOMAINS } from '@/domains/_registry';
import PioneersClient from './PioneersClient';

// Public onboarding page for early Pioneers — one link that gathers every TEC
// app + the 3-step engagement guide, so a Pioneer can open each app in Pi Browser
// and complete the login engagement that a Pi domain claim needs.
// Public by design (NOT in middleware PROTECTED_ROUTES) — no auth to view.
// The app count is derived from the LIVE domain registry so the copy never drifts.
export const metadata: Metadata = {
  title: 'TEC Ecosystem — Early Pioneers',
  description: `Be one of TEC’s first Pioneers. Open each app in Pi Browser, log in with Pi, and try one action. ${LIVE_DOMAINS.length} apps, live on Pi Mainnet.`,
};

export default function PioneersPage() {
  return <PioneersClient />;
}
