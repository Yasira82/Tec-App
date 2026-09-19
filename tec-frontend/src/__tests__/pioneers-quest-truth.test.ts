/**
 * The three places the Pioneer surface must not disagree with the server.
 *
 * The page and `tec-identity-service` hold two pictures of the same campaign,
 * and every finding pinned here was the page asserting something the server
 * did not agree with. Source-level assertions, because what is being pinned is
 * *which value feeds which sentence* — a rendering test passes just as happily
 * when the page computes the right answer from the wrong input.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const page     = read('src/app/pioneers/PioneersClient.tsx');
const coverage = read('src/app/hub/admin/pioneers/page.tsx');

describe('F1 — the Quest target comes from the campaign, not from what is live', () => {
  it('reads quest_target out of the stats response', () => {
    // `getStats()` has always published it; the page picked four fields and
    // dropped this one, then computed its own target from a runtime filter.
    expect(page).toMatch(/quest_target/);
    expect(page).toMatch(/setQuestTarget/);
  });

  it('falls back to the live count only when the server has not answered', () => {
    expect(page).toMatch(/const total = questTarget \?\? liveCount/);
  });

  it('does not derive the target from LIVE_DOMAINS.length any more', () => {
    // The old line. Take one app off `live` for an hour and this read 23/23,
    // 100%, and congratulated somebody the server would never number.
    expect(page).not.toMatch(/const total = LIVE_DOMAINS\.length/);
  });

  it('still lists every live app in the grid, counted separately', () => {
    // Two numbers with two meanings: the grid shows what is live, the Quest
    // asks for what the campaign froze. A 25th app mid-round is a bonus, not a
    // newly-imposed requirement.
    expect(page).toMatch(/const liveCount = LIVE_DOMAINS\.length/);
    expect(page).toMatch(/t\.appsTitle\(liveCount\)/);
  });
});

describe('F2 — only the server may promise a badge', () => {
  it('fires the completion banner on server state', () => {
    expect(page).toMatch(/\{serverCompleted && \(/);
  });

  it('does not fire it on the local count', () => {
    // `complete` is the local tally. It may drive the tier label; it may not
    // tell somebody they have earned one of a hundred permanent places.
    expect(page).not.toMatch(/\{complete && \(/);
  });

  it('treats a missing completed_at as not complete', () => {
    // P6: absent means no, never "unknown, assume yes".
    expect(page).toMatch(/setServerCompleted\(q\.completed_at != null\)/);
  });

  it('believes the write’s own response, so the badge lands on the tap that earns it', () => {
    expect(page).toMatch(/const sendOpen/);
    expect(page).toMatch(/data\?\.quest/);
  });

  it('re-sends the ticks the server never received', () => {
    // The ✓ is what stops a second tap, so before this the only retry path was
    // one the interface actively discouraged: a tick written during a backend
    // blip stayed local forever and the quest silently never completed.
    expect(page).toMatch(/serverOpened/);
    expect(page).toMatch(/visited\.filter\(\(s\) => !have\.has\(s\)\)/);
  });
});

describe('F4 — the arrival numbers reach the screen that aims the campaign', () => {
  it('declares both fields the service returns', () => {
    expect(coverage).toMatch(/arrived\?:\s*number/);
    expect(coverage).toMatch(/unconfirmed\?:\s*number/);
  });

  it('renders arrived', () => {
    expect(coverage).toMatch(/\{row\.arrived\} arrived/);
  });

  it('keeps verified as the headline rather than replacing it', () => {
    // Swapping the number outright would re-point the campaign mid-round
    // without saying so. Both are shown so the gap between them is legible.
    expect(coverage).toMatch(/\{row\.verified\} \/ \{row\.threshold\}/);
  });
});

describe('F6 — an admin page goes back to the page you came from', () => {
  const fromProfile = [
    'src/app/hub/admin/pioneers/page.tsx',
    'src/app/hub/admin/feedback/page.tsx',
    'src/app/hub/admin/kyc/page.tsx',
  ];

  it.each(fromProfile)('%s declares its parent', (p) => {
    // All three are reached from Profile's admin row. Defaulting to /hub walked
    // past the page you came from, so returning meant navigating in again.
    expect(read(p)).toMatch(/backTo="\/hub\/profile"/);
  });
});
