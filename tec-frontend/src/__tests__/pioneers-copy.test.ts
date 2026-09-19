/**
 * What the Pioneer page promises, and what it must not.
 *
 * The Quest is free and always will be — nothing on this path may require a
 * payment. And it asks nothing of you beyond a Pi account: `recordOpen` grants
 * the Founding number to any signed-in Pi identity, and the service says so —
 * `kyc_verified` is RECORDED, NOT ENFORCED.
 *
 * ── Why this file changed shape ────────────────────────────────────────────
 *
 * It used to be headed "the one condition is stated up front" and pinned the
 * sentence *"Needs a Pi-verified account"* into the hero. That condition was
 * never in the code. The FAQ said the opposite in schema.org data Google lifts
 * into search results, so the one question a cautious Pi user certainly asks
 * had three different answers and the loudest was the one the system did not
 * follow.
 *
 * These tests were doing their job — they held the copy still. They were
 * holding the wrong sentence still. So they are rewritten to pin what is now
 * true rather than deleted, because the risk they guard against is real: this
 * page will be edited by somebody who wants it to sound more exclusive, and
 * "verified accounts only" is the first thing that reaches for.
 *
 * What survives unchanged is the part that was always honest: we never ask for
 * documents, and we cannot see anybody's Pi status.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(
  join(process.cwd(), 'src/app/pioneers/PioneersClient.tsx'),
  'utf8',
);
const faq = readFileSync(
  join(process.cwd(), 'src/app/pioneers/faq/FaqClient.tsx'),
  'utf8',
);

describe('the Quest is free, and says so in both languages', () => {
  it('promises no payment, in English and Arabic', () => {
    expect(page).toContain('No payment, ever');
    expect(page).toContain('من غير أي دفع');
  });

  it('never asks anyone to buy anything to qualify', () => {
    // A reward the platform gives away must not grow a price later.
    expect(page).not.toMatch(/purchase (required|to qualify)/i);
  });
});

describe('the page does not invent a condition the code does not enforce', () => {
  it('no longer claims a verified Pi account is required', () => {
    // The exact sentences that were there. Named literally so that re-adding
    // one fails here rather than shipping.
    expect(page).not.toContain('Needs a Pi-verified account');
    expect(page).not.toContain('يتطلب حساب Pi موثّق');
    expect(page).not.toMatch(/must be KYC-verified/i);
    expect(page).not.toContain('لازم يكون موثّق');
  });

  it('says plainly that any Pi account qualifies, in both languages', () => {
    expect(page).toMatch(/Any Pi account qualifies/);
    expect(page).toContain('أي حساب Pi مؤهّل');
  });

  it('says the same thing the FAQ says', () => {
    // The two surfaces disagreed once. Both now state that there is no TEC
    // verification step, so a reader who checks the FAQ before trusting the
    // page finds the page confirmed rather than contradicted.
    expect(page).toMatch(/no TEC verification step/i);
    expect(faq).toMatch(/do not complete a separate TEC KYC/i);
  });

  it('still promises we never ask for documents', () => {
    // Unchanged, and the reason there is no gate: asking a first-time visitor
    // for identity documents to earn a badge reads as a scam.
    expect(page).toMatch(/no documents/i);
    expect(page).toContain('من غير مستندات');
  });

  it('still admits we cannot see the visitor’s Pi status', () => {
    expect(page).toMatch(/we cannot see it/);
    expect(page).toContain('مش بنقدر نشوفه');
  });
});

describe('the condition is not gated on the wrong register', () => {
  it('does not hide anything behind TEC’s own kyc_verified flag', () => {
    // `kyc_verified` on a quest is TEC's KYC register; Pi's is Pi's. Firing
    // copy off that flag once told a Pi-verified visitor they were unverified.
    expect(page).not.toContain('setKycNeeded');
    expect(page).not.toMatch(/kyc_verified === false/);
  });
});

describe('the gift is on the page that sells it', () => {
  it('names the 6 months of PRO, in both languages', () => {
    // 180 days of PRO is granted on completion and was mentioned nowhere a
    // visitor could read it — the largest thing on offer, invisible on the one
    // page whose job is to convert.
    expect(page).toMatch(/6 months of TEC PRO/);
    expect(page).toContain('٦ شهور TEC PRO');
  });

  it('says it is a period that ends, not a permanent plan', () => {
    // There is no auto-renewal by design, and `giftFoundingPro` is explicitly
    // fail-safe. "Free PRO for Founding Pioneers" with no end date would be a
    // second promise the code does not keep.
    expect(page).toMatch(/not a permanent plan/i);
    expect(page).toContain('مش اشتراك دائم');
  });
});
