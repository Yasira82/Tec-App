'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function HubPayRedirectInner() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('pay', '1');
    if (params.get('amount'))     qs.set('amount',     params.get('amount')!);
    if (params.get('memo'))       qs.set('memo',       params.get('memo')!);
    if (params.get('return_url')) qs.set('return_url', params.get('return_url')!);
    if (params.get('product_id')) qs.set('product_id', params.get('product_id')!);
    if (params.get('source'))     qs.set('source',     params.get('source')!);
    router.replace(`/hub?${qs.toString()}`);
  }, [params, router]);

  return (
    <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.15)', borderTopColor: '#FBBF24', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function HubPayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(251,191,36,0.15)', borderTopColor: '#FBBF24', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <HubPayRedirectInner />
    </Suspense>
  );
}
