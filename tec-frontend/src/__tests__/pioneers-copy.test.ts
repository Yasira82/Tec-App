/**
 * What the Pioneer page promises, and what it must not.
 *
 * The Quest is free and always will be — nothing on this path may require a
 * payment. What it DOES require is a Pi-verified account, because Pi counts
 * only KYC'd Pioneers toward a `.pi` domain claim, and that is the whole
 * reason the campaign exists (C-134 §20).
 *
 * Stating a condition the app does not itself enforce is a promise that has to
 * be worded carefully: we say Pi decides it, and we say we never ask for
 * documents. Both are true, and both are pinned here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(
  join(process.cwd(), 'src/app/pioneers/PioneersClient.tsx'),
  'utf8',
);

describe('the Quest is free, and says so in both languages', () => {
  it('promises no payment, in English and Arabic', () => {
    expect(page).toContain('No payment, ever');
    expect(page).toContain('من غير أي دفع');
  });

  it('never asks anyone to buy anything to qualify', () => {
    // A reward the platform gives away must not grow a price later. The gift is
    // six months of PRO for completing the Quest — no purchase at any step.
    expect(page).not.toMatch(/purchase (required|to qualify)/i);
  });
});

describe('the one condition is stated up front', () => {
  it('the hero line carries it, before anyone logs in', () => {
    // The moment a person decides whether the Quest is worth starting is before
    // signing in — a condition revealed afterwards has already cost their time.
    expect(page).toContain('Needs a Pi-verified account');
    expect(page).toContain('يتطلب حساب Pi موثّق');
  });

  it('names Pi as the one who decides, not us', () => {
    expect(page).toMatch(/KYC-verified by Pi Network/);
    expect(page).toMatch(/موثّق \(KYC\) من Pi Network/);
  });

  it('promises we never ask for documents', () => {
    // The reason there is no KYC gate at all: asking a first-time visitor for
    // identity documents to earn a badge reads as a scam.
    expect(page).toMatch(/never ask you for documents/);
    expect(page).toMatch(/مش بنطلب منك أي مستندات/);
  });

  it('admits we cannot see the visitor’s Pi status', () => {
    // Stating a condition we do not enforce is only honest if we say who does.
    expect(page).toMatch(/cannot see your Pi status/);
    expect(page).toMatch(/مش بنقدر نشوف حالة توثيقك/);
  });
});

describe('the condition is not gated on the wrong register', () => {
  it('does not hide the note behind TEC’s own kyc_verified flag', () => {
    // `kyc_verified` on a quest is TEC's KYC register; Pi's requirement is about
    // Pi's. Firing the note off that flag told a Pi-verified visitor they were
    // unverified, and hid the condition entirely from anyone not yet logged in.
    expect(page).not.toContain('setKycNeeded');
    expect(page).not.toMatch(/kyc_verified === false/);
  });
});
