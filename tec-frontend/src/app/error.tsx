'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      color: 'var(--white)',
      fontFamily: "'DM Sans', sans-serif",
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '48px 32px',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 24px',
          background: 'rgba(231,76,60,0.1)',
          border: '1px solid rgba(231,76,60,0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
        }}>
          ⚠️
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '28px',
          fontWeight: 400,
          color: 'var(--white)',
          margin: '0 0 12px',
        }}>
          حدث خطأ ما
        </h1>

        <p style={{
          fontSize: '14px',
          color: 'var(--muted)',
          margin: '0 0 8px',
          lineHeight: 1.6,
        }}>
          Something went wrong
        </p>

        <p style={{
          fontSize: '13px',
          color: 'var(--muted)',
          margin: '0 0 24px',
          lineHeight: 1.6,
        }}>
          We encountered an error while processing your request.
        </p>

        {/* Error ID */}
        {error.digest && (
          <p style={{
            fontSize: '11px',
            color: 'var(--muted)',
            margin: '0 0 20px',
            letterSpacing: '0.05em',
          }}>
            Error ID: {error.digest}
          </p>
        )}

        {/* ✅ عرض الـ error message دايماً عشان نشوف المشكلة */}
        {/* Dev only — error message */}
{process.env.NODE_ENV !== 'production' && error.message && (
          <div style={{
            margin: '0 0 24px',
            padding: '12px 16px',
            background: 'rgba(231,76,60,0.06)',
            border: '1px solid rgba(231,76,60,0.15)',
            borderRadius: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#e74c3c',
            textAlign: 'left',
            maxHeight: '120px',
            overflowY: 'auto',
            wordBreak: 'break-all',
          }}>
            {error.message}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={reset}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #c9a84c, #a07830)',
              color: '#050507',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            🔄 إعادة المحاولة / Try again
          </button>

          <Link
            href="/"
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 24px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--muted)',
              textDecoration: 'none',
              textAlign: 'center',
              transition: 'border-color 0.2s, color 0.2s',
              boxSizing: 'border-box',
            }}
          >
            ← العودة للرئيسية / Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}
