export const dynamic = 'force-dynamic';

import dynamic from 'next/dynamic';

const AiClient = dynamic(() => import('./AiClient'), { ssr: false });

export default function AiPage() {
  return <AiClient />;
}
