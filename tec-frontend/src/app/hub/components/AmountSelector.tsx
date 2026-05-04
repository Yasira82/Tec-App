'use client';

import { useState } from 'react';

const PRESETS = [1, 5, 10, 50];

const haptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
};

export function AmountSelector({ value, onChange, disabled }: {
  value:    number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customRaw,  setCustomRaw]  = useState('');
  const isPreset = PRESETS.includes(value) && !showCustom;

  const handlePreset = (v: number) => {
    haptic('light'); onChange(v); setShowCustom(false); setCustomRaw('');
  };

  const handleCustomChange = (raw: string) => {
    setCustomRaw(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) onChange(n);
  };

  const toggleCustom = () => {
    haptic('light');
    setShowCustom(p => { if (!p) setCustomRaw(''); return !p; });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {PRESETS.map(p => {
          const active = value === p && isPreset;
          return (
            <button key={p} onClick={() => handlePreset(p)} disabled={disabled}
              style={{ flex: 1, padding: '11px 0', borderRadius: 14, background: active ? '#d4af3718' : '#0d0d14', border: `1px solid ${active ? '#d4af3760' : '#ffffff10'}`, color: active ? '#d4af37' : '#6b6b7a', fontWeight: 700, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {p}π
            </button>
          );
        })}
        <button onClick={toggleCustom} disabled={disabled}
          style={{ flex: 1, padding: '11px 0', borderRadius: 14, background: showCustom ? '#d4af3718' : '#0d0d14', border: `1px solid ${showCustom ? '#d4af3760' : '#ffffff10'}`, color: showCustom ? '#d4af37' : '#6b6b7a', fontWeight: 700, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
          ✏️
        </button>
      </div>
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0d0d14', border: '1px solid #d4af3740', borderRadius: 14, padding: '12px 16px' }}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 20, color: '#d4af37' }}>π</span>
          <input type="number" min="0.01" step="0.01" value={customRaw} onChange={e => handleCustomChange(e.target.value)}
            placeholder="Enter amount" autoFocus
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
          {customRaw && (
            <button onClick={() => { setCustomRaw(''); onChange(1); }}
              style={{ background: 'none', border: 'none', color: '#4a4a5a', cursor: 'pointer', fontSize: 16 }}>✕</button>
          )}
        </div>
      )}
    </div>
  );
}
