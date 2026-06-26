'use client';

import { useRouter }      from 'next/navigation';
import { haptic }         from '@/lib/hub/utils';
import { AmountSelector } from '@/app/hub/components/AmountSelector';

interface Props {
  payAmount:    number;
  setPayAmount: (n: number) => void;
  piReady:      boolean;
  onPay:        () => void;
}

export function HubPayActions({ payAmount, setPayAmount, piReady, onPay }: Props) {
  const router = useRouter();

  return (
    <div style={{ padding: '16px 16px 0', animation: 'tec-fade-in 0.55s ease both' }}>
      <AmountSelector value={payAmount} onChange={setPayAmount} disabled={!piReady} />
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>

        <button className="tec-btn" onClick={onPay} disabled={!piReady}
          aria-label={`Pay ${payAmount} Pi`}
          style={{
            flex: 1, padding: '15px 12px', borderRadius: 18,
            background: piReady ? 'linear-gradient(135deg,#0a2218,#06180e)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${piReady ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: piReady ? '#22C55E' : 'rgba(255,255,255,0.2)',
            fontWeight: 700, fontSize: 13, cursor: piReady ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: piReady ? '0 0 20px rgba(34,197,94,0.1)' : 'none',
          }}>
          {!piReady
            ? <><div className="tec-spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.3)' }} /><span>Connecting…</span></>
            : <><span style={{ fontFamily: 'Georgia,serif', fontSize: 17 }}>π</span><span>Pay</span></>
          }
        </button>

        <button className="tec-btn"
          onClick={() => { haptic('light'); router.push('/dashboard/wallet'); }}
          aria-label="Receive Pi"
          style={{
            flex: 1, padding: '15px 12px', borderRadius: 18,
            background: 'linear-gradient(135deg,#0a1628,#060f1e)',
            border: '1px solid rgba(59,130,246,0.25)',
            color: '#3b82f6', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 0 20px rgba(59,130,246,0.08)',
          }}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 17 }}>π</span>
          <span>Receive</span>
        </button>

      </div>
    </div>
  );
}
