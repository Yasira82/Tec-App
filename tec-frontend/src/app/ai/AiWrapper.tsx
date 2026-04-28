'use client';

import dynamicImport from 'next/dynamic';

const AiClient = dynamicImport(() => import('./AiClient'), { ssr: false });

export default function AiWrapper() {
  return <AiClient />;
}
