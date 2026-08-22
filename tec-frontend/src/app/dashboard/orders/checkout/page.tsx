'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePiAuth }     from '@/lib-client/hooks/usePiAuth';
import { getAccessToken } from '@/lib-client/pi/pi-auth';
import { sessionToken } from '@/lib-client/pi/session-source';

const getCsrfToken = (): string => {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find(r => r.startsWith('tec_csrf='))?.split('=')?.[1] ?? '';
};

interface CartItem {
  product_id: string;
  title:      string;
  price:      number;
  currency:   string;
  quantity:   number;
}

type CheckoutStep = 'review' | 'paying' | 'success' | 'error';

export default function CheckoutPage() {
  const { user, isAuthenticated } = usePiAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [step,    setStep]    = useState<CheckoutStep>('review');
  const [error,   setError]   = useState('');
  const [orderId, setOrderId] = useState('');
  const [items,   setItems]   = useState<CartItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/'); return; }
    const productId = searchParams.get('product_id');
    if (productId) {
      setItems([{
        product_id: productId,
        title:      searchParams.get('title')    ?? 'Product',
        price:      parseFloat(searchParams.get('price') ?? '1'),
        currency:   searchParams.get('currency') ?? 'PI',
        quantity:   parseInt(searchParams.get('qty') ?? '1'),
      }]);
    }
  }, [isAuthenticated, router, searchParams]);

  const total    = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const currency = items[0]?.currency ?? 'PI';

  const handleCheckout = async () => {
    if (!user?.id || !items.length) return;
    setStep('paying');
    setError('');

    // ✅ VM-NEW-002: cookie بدل localStorage
    const token = sessionToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-csrf-token': getCsrfToken(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    try {
      const createRes = await fetch('/api/commerce/orders', {
        method:      'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          buyer_id: user.id,
          items:    items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.message ?? 'Failed to create order');

      const newOrderId = createData.data?.order?.id ?? createData.data?.id;
      if (!newOrderId) throw new Error('No order ID returned');
      setOrderId(newOrderId);

      const payRes = await fetch('/api/payment/create', {
        method:      'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          userId:         user.id,
          amount:         total,
          currency,
          payment_method: 'pi',
          metadata:       { order_id: newOrderId },
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.message ?? 'Payment failed');

      const paymentId = payData.data?.payment?.id;
      if (!paymentId) throw new Error('No payment ID');

      const checkoutRes = await fetch('/api/commerce/orders/checkout', {
        method:      'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ order_id: newOrderId, payment_id: paymentId }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.message ?? 'Checkout failed');

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setStep('error');
    }
  };

  const s = (style: React.CSSProperties) => style;

  if (step === 'success') {
    return (
      <div style={s({ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 })}>
        <div style={s({ textAlign: 'center', maxWidth: 400 })}>
          <div style={s({ fontSize: 64, marginBottom: 16 })}>✅</div>
          <h2 style={s({ fontSize: 24, fontWeight: 800, color: '#7ee7c0', marginBottom: 8 })}>Order Confirmed!</h2>
          <p style={s({ color: '#6b6b7a', fontSize: 14, marginBottom: 8 })}>
            Order ID: <span style={s({ color: '#FBBF24', fontFamily: 'monospace' })}>{orderId.slice(0, 8).toUpperCase()}</span>
          </p>
          <p style={s({ color: '#4a4a5a', fontSize: 13, marginBottom: 24 })}>
            Total paid: {total.toFixed(2)} {currency === 'PI' ? 'π' : currency}
          </p>
          <button
            onClick={() => router.push('/dashboard/orders')}
            style={s({ padding: '12px 32px', background: '#FBBF2415', border: '1px solid #FBBF2440', borderRadius: 14, color: '#FBBF24', fontWeight: 700, fontSize: 14, cursor: 'pointer' })}
          >
            View Orders →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s({ minHeight: '100vh', background: '#050816', color: '#fff', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' })}>
      <div style={s({ maxWidth: 480, margin: '0 auto' })}>

        <div style={s({ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 })}>
          <button onClick={() => router.back()} style={s({ background: 'none', border: 'none', color: '#6b6b7a', fontSize: 20, cursor: 'pointer' })}>←</button>
          <h1 style={s({ fontSize: 22, fontWeight: 800, margin: 0 })}>Checkout</h1>
        </div>

        <div style={s({ background: '#0B1020', border: '1px solid #ffffff10', borderRadius: 18, padding: 20, marginBottom: 16 })}>
          <div style={s({ fontSize: 11, color: '#6b6b7a', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 })}>Order Summary</div>
          {items.length === 0 ? (
            <p style={s({ color: '#4a4a5a', fontSize: 13 })}>No items in cart</p>
          ) : (
            items.map((item, i) => (
              <div key={i} style={s({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid #ffffff08' : 'none' })}>
                <div>
                  <div style={s({ fontSize: 14, fontWeight: 600, color: '#fff' })}>{item.title}</div>
                  <div style={s({ fontSize: 12, color: '#6b6b7a' })}>Qty: {item.quantity}</div>
                </div>
                <div style={s({ fontSize: 14, fontWeight: 700, color: '#FBBF24' })}>
                  {(item.price * item.quantity).toFixed(2)} {item.currency === 'PI' ? 'π' : item.currency}
                </div>
              </div>
            ))
          )}
          <div style={s({ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px solid #FBBF2420' })}>
            <span style={s({ fontWeight: 700, color: '#fff' })}>Total</span>
            <span style={s({ fontSize: 18, fontWeight: 900, color: '#FBBF24' })}>
              {total.toFixed(2)} {currency === 'PI' ? 'π' : currency}
            </span>
          </div>
        </div>

        {step === 'error' && error && (
          <div style={s({ padding: '12px 16px', background: '#1a0505', border: '1px solid #e74c3c30', borderRadius: 12, color: '#e74c3c', fontSize: 13, marginBottom: 16 })}>
            ❌ {error}
          </div>
        )}

        <button
          onClick={handleCheckout}
          disabled={step === 'paying' || items.length === 0}
          style={s({
            width: '100%', padding: '16px', borderRadius: 18,
            background:     step === 'paying' ? '#0a1f0f' : 'linear-gradient(135deg,#0d2e14,#0a1f0f)',
            border:         '1px solid #7ee7c040',
            color:          '#7ee7c0', fontWeight: 700, fontSize: 15,
            cursor:         step === 'paying' ? 'not-allowed' : 'pointer',
            display:        'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          })}
        >
          {step === 'paying' ? (
            <>
              <div style={s({ width: 16, height: 16, border: '2px solid #7ee7c030', borderTop: '2px solid #7ee7c0', borderRadius: '50%', animation: 'spin 0.6s linear infinite' })} />
              Processing...
            </>
          ) : (
            <>💎 Pay {total.toFixed(2)} π</>
          )}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
