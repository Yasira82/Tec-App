export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic';

const AiClient = dynamicImport(() => import('./AiClient'), { ssr: false });

export default function AiPage() {
  return <AiClient />;
}
