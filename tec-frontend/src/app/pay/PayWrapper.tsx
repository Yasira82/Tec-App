'use client';

import dynamicImport from 'next/dynamic';

const PayClient = dynamicImport(() => import('./PayClient'), { ssr: false });

export default function PayWrapper() {
  return <PayClient />;
}
