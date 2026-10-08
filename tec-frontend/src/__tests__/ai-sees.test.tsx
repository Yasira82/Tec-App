/**
 * "What TEC AI can see now" (AIMenu → Settings). The second reading asked "can you see
 * my goals in Life?"; the answer now comes from the read itself — a consent switch, an
 * empty list, a missing profile and a failed read each say something different.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AIMenu } from '@/components/ai/AIMenu';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

const open = (seen: unknown, ok = true) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => ({ seen }) }));
  render(<AIMenu storeKey="t" locale="en" onRestore={vi.fn()} onAsk={vi.fn()} onClearAll={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByText('Settings'));
};

describe('what TEC AI sees', () => {
  it('goals shared, with the count; skills not shared; pace shared', async () => {
    open({ life: 'read', consent: { GOALS: true, SKILLS: false, TRAJECTORY: true }, goals: 3, skills: null, pace: false });
    await waitFor(() => expect(screen.getByText(/shared · 3/)).toBeTruthy());
    expect(screen.getByText(/not shared/)).toBeTruthy();
    expect(screen.getByText(/Life → Privacy/)).toBeTruthy();
  });

  it('shared but empty is not the same as not shared', async () => {
    open({ life: 'read', consent: { GOALS: true }, goals: 0, skills: null, pace: false });
    await waitFor(() => expect(screen.getByText(/shared · none active/)).toBeTruthy());
  });

  it('a missing Life profile says so', async () => {
    open({ life: 'no_profile', consent: {}, goals: 0, skills: null, pace: false });
    await waitFor(() => expect(screen.getByText(/No Life profile yet/)).toBeTruthy());
  });

  it('a failed read says the assistant answers without Life — never "not shared"', async () => {
    open({ life: 'unavailable', consent: {}, goals: 0, skills: null, pace: false });
    await waitFor(() => expect(screen.getByText(/could not be read just now/)).toBeTruthy());
    expect(screen.queryByText(/not shared/)).toBeNull();
  });

  it('the chat route never reads `seen` — it is for the person, not the model', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/ai/chat/route.ts'), 'utf8');
    expect(route).not.toMatch(/\bseen\b/);
  });
});
