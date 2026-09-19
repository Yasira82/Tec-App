/**
 * The campaign surfaces — the claim form and the payout queue.
 *
 * Real Pi moves at the end of this flow, sent by hand to an address a person
 * typed. Every assertion here guards one of the three ways that goes wrong:
 * the wrong header on an admin route, a phishing-shaped form, or a screen that
 * implies an instant payout that will not come.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read   = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
/** Comments stripped — these assertions are about what the code DOES. */
const codeOf = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the admin payout route forwards the user, not a service credential', () => {
  const route = codeOf('app/api/admin/campaign/claims/route.ts');

  it('never attaches x-internal-key', () => {
    // This list carries every claimant's wallet address. identity-service reads
    // that header as a ServiceActor credential and skips the role check.
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
  });

  it('refuses before calling the gateway when there is no token', () => {
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('passes the service’s status through', () => {
    expect(route).toMatch(/status: res\.status/);
  });

  it('only ever sends the actions it knows', () => {
    // An action taken from the body unchecked would let a caller reach any
    // path segment under the claim — and one of them now MOVES Pi.
    expect(route).toMatch(/const ACTIONS = \['paid', 'reject', 'send', 'unpaid'\] as const/);
    expect(route).toMatch(/ACTIONS\.find\(\(a\) => a === body\?\.action\)/);
  });

  it('REFUSES an action it does not know, instead of assuming `paid`', () => {
    // The set was always closed; the fallback was not. Anything unrecognised
    // used to land on the action that RECORDS A PAYMENT. Not exploitable —
    // markPaid still demands a chain-confirmed hash no other seat holds — but
    // P6 says doubt denies, and doubt was choosing the most consequential verb
    // in the set.
    expect(route).toMatch(/if \(!action\)/);
    expect(route).toMatch(/status: 400/);
    // And no ternary can quietly reintroduce the old default.
    expect(route).not.toMatch(/: 'paid';/);
  });
});

describe('the claim route does not decide who gets paid', () => {
  const route = codeOf('app/api/bff/campaign/claim/route.ts');

  it('never names the OWNER — the half of the rule that has not moved', () => {
    // The service derives the owner from the verified token. A route that
    // decides who receives Pi is the last place to let a caller say who that
    // is, and a body that cannot carry it cannot be made to.
    expect(route).not.toMatch(/owner|username|pi_uid/);
  });

  it('may carry the address, and does not second-guess it', () => {
    // The address stopped being the payout destination: A2U pays a Pi uid and
    // Pi resolves the wallet, so nothing sent here reaches the transfer. It is
    // the one-wallet-one-reward key, which the service's unique constraint
    // enforces — and the service applies one checksum to both the posted and
    // the typed route. A second opinion in the BFF is a second place for the
    // rule to drift, which is exactly how Pro detection broke fleet-wide.
    expect(route).toMatch(/wallet_address/);
    expect(route).not.toMatch(/\/\^G\[A-Z2-7\]|validatePiAddress|\.length === 56/);
  });

  it('sends no body at all when there is no address to send', () => {
    // A claim from the group route stays exactly what it was: a POST with
    // nothing in it.
    expect(route).toMatch(/\.\.\.\(typed \? \{/);
  });

  it('requires auth', () => {
    expect(route).toContain('requireAuth: true');
  });

  it('carries the service’s own message on failure', () => {
    // The service knows WHICH way an address was wrong, and which app is still
    // missing. A generic failure hides the only line a person can act on.
    expect(route).toMatch(/data\?\.message \?\? data\?\.error/);
  });
});

describe('an unreadable campaign is CLOSED, never open', () => {
  const route = codeOf('app/api/bff/campaign/status/route.ts');

  it('falls back to open:false when the gateway cannot be reached', () => {
    // The page must not invite someone to earn Pi it cannot confirm is still
    // on offer (P6).
    expect(route).toMatch(/data: \{ open: false \}/);
  });
});

describe('the claim form is not shaped like a phishing page', () => {
  /**
   * These assertions used to read the component, because the copy lived in it.
   * It now lives in the locale files — so they read those, and they read BOTH.
   *
   * That is not bookkeeping. An anti-phishing warning that exists in English and
   * not in Arabic is the exact gap this page had: the Hub card advertised the
   * campaign in Arabic and the page answered entirely in English. A guarantee
   * that only one audience receives is not a guarantee.
   */
  const page = read('app/hub/campaign/page.tsx');
  const en   = read('lib/i18n/en.ts');
  const ar   = read('lib/i18n/ar.ts');

  it('says we will NEVER ask for a passphrase, before it asks for an address', () => {
    // "Send us your wallet address" is a shape people are phished with. The
    // only defence is to say, before they post one, what we will never ask for.
    //
    // The anchor used to be `<input` — and that was vacuous twice over. The
    // address is never typed on this page (it is read back from the group), so
    // the only `<input` is the correction field far below; and the search term
    // was the bare word "never", which matched a source comment on line 17 and
    // passed no matter where the warning sat. Made honest, it failed: the
    // warning was down beside the claim, while the Connection mission ABOVE it
    // is the thing that says "post your Pi wallet address there". The warning
    // moved above the missions. That is the order this test exists to hold.
    const warning = page.indexOf('c.neverAsk1');
    const asksForAddress = page.indexOf('c.missionConnection');
    expect(warning).toBeGreaterThan(-1);
    expect(asksForAddress).toBeGreaterThan(-1);
    expect(warning).toBeLessThan(asksForAddress);
    expect(en).toMatch(/passphrase or secret key/);
    // Arabic: the passphrase and the secret key, named.
    expect(ar).toMatch(/العبارة السرية/);
    expect(ar).toMatch(/المفتاح الخاص/);
  });

  it('asks for the PUBLIC address by name, in both languages', () => {
    expect(en).toMatch(/public address/);
    expect(en).toMatch(/starts with/);
    expect(ar).toMatch(/العام/);
    expect(ar).toMatch(/بيبدأ بحرف/);
  });

  it('never mentions a payment to qualify, in either language', () => {
    expect(en).toMatch(/there is no payment at any step/);
    expect(ar).toMatch(/مفيش أي دفع في أي خطوة/);
  });
});

describe('an address can be typed when the group has none', () => {
  /**
   * The group used to be the only route, and for anyone who used the chat
   * without pasting 56 characters into it that was a dead end: every mission
   * done, and nothing on the screen to do about it.
   *
   * It could come back because the address stopped being the payout
   * destination — A2U pays a Pi uid and Pi resolves the wallet. What the
   * address still does is bound the campaign to one reward per wallet, and a
   * typed one does that exactly as well as a posted one.
   */
  const page = codeOf('app/hub/campaign/page.tsx');

  it('offers the field ONLY to somebody with nothing posted', () => {
    // Everybody else still types nothing: their address is read back to them
    // and the seat is taken on its own. A field shown to them would be a
    // question they already answered.
    expect(page).toMatch(/\) : !me\?\.posted_address \? \(/);
  });

  it('keeps the phishing warning ahead of the field, not just ahead of the mission', () => {
    const warning = page.indexOf('c.neverAsk1');
    const field   = page.indexOf('c.typeAddrIntro');
    expect(field).toBeGreaterThan(-1);
    expect(warning).toBeLessThan(field);
  });

  it('says WHY the address is wanted — in both languages', () => {
    // "Give us your wallet address" with no reason is the shape of every Pi
    // scam. The reason is the anti-sybil rule, and it is the truth.
    expect(read('lib/i18n/en.ts')).toMatch(/each wallet can claim a single reward/i);
    expect(read('lib/i18n/ar.ts')).toMatch(/كل محفظة ليها مكافأة واحدة/);
  });

  it('still points at the group as the other way', () => {
    expect(read('lib/i18n/en.ts')).toMatch(/post it in the TEC group instead/i);
    expect(read('lib/i18n/ar.ts')).toMatch(/تنشره في جروب TEC/);
  });

  it('will not submit an empty field', () => {
    expect(page).toMatch(/disabled=\{sending \|\| claimAddr\.trim\(\)\.length === 0\}/);
  });
});

describe('the payout queue shows WHY the reward is owed', () => {
  /**
   * The service already refuses an unqualified claim, so this is not the check
   * — it is the EVIDENCE of one, on the screen where somebody decides to move
   * real Pi. "The service verified it" and "I can see what it verified" stop
   * being the same sentence somewhere around the fiftieth claim.
   */
  const admin = codeOf('app/hub/admin/campaign/page.tsx');

  it('renders the frozen record, not a live recount', () => {
    // The whole reason the column exists. `CAMPAIGN_APPS` is an env var that
    // changes between rounds — recomputing here would show a pioneer who met
    // every requirement of their own round as "7 of 24" the day the list grows.
    expect(admin).toMatch(/claim\.qualified/);
    expect(admin).toMatch(/q\.done\.length\} \/ \{q\.required\.length/);
    // No second opinion about which apps count. That answer is on the row.
    expect(admin).not.toMatch(/CAMPAIGN_APPS/);
  });

  it('says so plainly when there is no record, instead of showing zero', () => {
    // "0 of 0" on an older claim reads as "did nothing" — a sentence about a
    // person that the data does not support.
    expect(admin).toMatch(/Claimed before missions were recorded/);
  });

  it('names the list the claim was measured against', () => {
    expect(admin).toMatch(/apps this round asked for, not today/);
  });

  it('dates the evidence', () => {
    // A tick with no date could mean anything.
    expect(admin).toMatch(/shortDate/);
  });
});

describe('the back arrow goes back one step, not to the Hub', () => {
  const shell = codeOf('components/hub/HubSubShell.tsx');

  it('takes a declared parent rather than guessing from history', () => {
    // `router.back()` is history, and history is not the page hierarchy:
    // arriving from a shared link or after an SSO bounce it walks off the app
    // entirely, in a browser with no tabs.
    expect(shell).toMatch(/backTo = '\/hub'/);
    expect(shell).toMatch(/router\.push\(backTo\)/);
    expect(shell).not.toMatch(/router\.back\(\)/);
  });

  it('the nested admin pages declare theirs', () => {
    // campaign → admin → diagnose. Each arrow now lands on the page you came
    // from instead of skipping past it to /hub.
    expect(codeOf('app/hub/admin/campaign/page.tsx')).toMatch(/backTo="\/hub\/campaign"/);
    expect(codeOf('app/hub/admin/campaign/diagnose/page.tsx')).toMatch(/backTo="\/hub\/admin\/campaign"/);
  });
});

describe('the campaign can be handed to somebody else', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('uses the share sheet when there is one, and the clipboard when there is not', () => {
    // A button that silently does nothing on one of the two is a button that
    // teaches people not to press it.
    expect(page).toMatch(/navigator\.share/);
    expect(page).toMatch(/navigator\.clipboard\.writeText/);
  });

  it('shares the live URL rather than a hardcoded one', () => {
    // So a preview deployment shares itself and not production.
    expect(page).toMatch(/window\.location\.href/);
  });

  it('promises no number that will have gone stale by the time it is read', () => {
    // The text is pasted into a chat and read hours later. A seat count in it
    // is a claim about the present tense that the message cannot keep.
    const en = read('lib/i18n/en.ts');
    const ar = read('lib/i18n/ar.ts');
    expect(en).toMatch(/shareText:/);
    expect(ar).toMatch(/shareText:/);
    const shareLine = /shareText:\s*'([^']*)'/;
    expect(shareLine.exec(en)?.[1] ?? '').not.toMatch(/\d/);
    expect(shareLine.exec(ar)?.[1] ?? '').not.toMatch(/\d/);
  });
});

describe('a full campaign is not the same as no campaign', () => {
  /**
   * `open: false` carried two opposite facts — the round is not configured, and
   * every seat is taken — and the page told the same story about both. So at the
   * exact moment the campaign SUCCEEDED, the 101st arrival read "No campaign is
   * running" and reasonably concluded they had been sent somewhere fake, on the
   * one screen whose whole job is converting a stranger.
   */
  const page = codeOf('app/hub/campaign/page.tsx');

  it('picks the sentence from the reason the service gave', () => {
    expect(page).toMatch(/status\?\.closed_reason === 'full' \? c\.fullTitle : c\.closedTitle/);
  });

  it('falls back to the neutral sentence when the reason is unknown', () => {
    // An older service, or an unreachable one, must not produce a confident
    // wrong answer about why the door is shut.
    expect(page).toMatch(/closed_reason\?: 'not_configured' \| 'full' \| null/);
  });

  it('reads as an achievement, not a refusal — in both languages', () => {
    const en = read('lib/i18n/en.ts');
    const ar = read('lib/i18n/ar.ts');
    expect(en).toMatch(/Every seat is taken/);
    expect(en).toMatch(/next one will be announced/i);
    expect(ar).toMatch(/كل المقاعد اتحجزت/);
    expect(ar).toMatch(/الجولة الجاية هتتعلن/);
  });

  it('does not offer Share on a door that is shut', () => {
    // The whole value of a share is that it arrives from somebody trusted.
    expect(page).toMatch(/actions=\{status\?\.open/);
  });
});

describe('a refresh is not a first load', () => {
  /**
   * Every mission opens a NEW TAB, so returning is the loop the page is built
   * around — 24 times per pioneer. Each return used to replace the mission list
   * with grey blocks and rebuild it. Nobody reports this, because a flashing
   * skeleton reads as "slow" rather than "wrong".
   */
  it('only the first load darkens the pioneer page', () => {
    const page = codeOf('app/hub/campaign/page.tsx');
    expect(page).toMatch(/if \(firstLoad\.current\) setLoading\(true\)/);
    expect(page).toMatch(/firstLoad\.current = false/);
  });

  it('and the payout queue keeps your place after an action', () => {
    // Recording one payout used to rebuild the whole list — the worst moment to
    // lose your place in a list you are working down.
    const admin = codeOf('app/hub/admin/campaign/page.tsx');
    expect(admin).toMatch(/if \(firstLoad\.current\) setLoading\(true\)/);
  });
});

describe('the payout queue at a hundred rows', () => {
  const admin = codeOf('app/hub/admin/campaign/page.tsx');

  it('finds a claim by the three things somebody arrives holding', () => {
    // A pioneer asking "where is my Pi" gives you a username. A transfer you
    // are checking gives you an address. A note gives you a seat.
    expect(admin).toMatch(/c\.owner\.toLowerCase\(\)\.includes\(needle\)/);
    expect(admin).toMatch(/c\.wallet_address\.toLowerCase\(\)\.includes\(needle\)/);
    expect(admin).toMatch(/String\(c\.seat \?\? ''\)\.includes\(needle\)/);
  });

  it('keeps the TOTAL on the whole queue, not on the search result', () => {
    // A number that shrinks as you type will be read as the amount owed, and
    // reported as one.
    expect(admin).toMatch(/\{claims\.length\} waiting · \{owed\} π to send/);
    expect(admin).toMatch(/showing \{shown\.length\}/);
  });

  it('tells "no match" apart from "nobody is waiting"', () => {
    // An admin who read the second while the first was true would conclude the
    // queue had emptied.
    expect(admin).toMatch(/No claim matches/);
  });

  it('exports exactly what is listed — filter and search included', () => {
    // A file that silently contained more than the list above it is a quiet lie.
    expect(admin).toMatch(/shown\.map\(\(c\) => \[/);
  });

  it('quotes every CSV cell and doubles internal quotes', () => {
    // A username is user-supplied text. One bare comma shifts every later
    // column under the wrong header.
    expect(admin).toMatch(/replace\(\/"\/g, '""'\)/);
  });

  it('writes a BOM, or Excel mangles any non-ASCII username', () => {
    expect(admin).toMatch(/\\uFEFF/);
  });
});

describe('the wait is stated, not implied away', () => {
  const en = read('lib/i18n/en.ts');
  const ar = read('lib/i18n/ar.ts');

  it('tells a claimant a person sends it by hand', () => {
    // A screen implying an instant payout turns a normal wait into a suspicion
    // that they have been cheated.
    expect(en).toMatch(/A person sends the Pi by hand, so this is not instant/);
    expect(ar).toMatch(/بيبعت الـ Pi بإيده/);
  });

  it('promises the transaction id as the proof', () => {
    expect(en).toMatch(/transaction id here when it is done/);
    expect(ar).toMatch(/رقم العملية/);
  });
});

describe('a wrong address can be corrected before the Pi is sent', () => {
  const page  = read('app/hub/campaign/page.tsx');
  const route = codeOf('app/api/bff/campaign/claim/address/route.ts');

  it('offers the fix ONLY while the claim is still waiting', () => {
    // Once the Pi has been sent, the address is where it went. Rewriting the
    // record afterwards would make it describe a transfer that never happened
    // — the service refuses it too, and a control that always fails is worse
    // than no control.
    // Structure stays asserted against the component; the sentence against the copy.
    expect(page).toMatch(/claim\.status === 'CLAIMED' && !editing/);
    expect(read('lib/i18n/en.ts')).toMatch(/Wrong address\? Change it before it is sent/);
  });

  it('says the seat is not at stake', () => {
    // Somebody who thinks correcting a typo costs them their place will leave
    // it wrong.
    expect(read('lib/i18n/en.ts')).toMatch(/You keep seat/);
    expect(read('lib/i18n/ar.ts')).toMatch(/هيفضل بتاعك/);
  });

  it('names the mistake that actually happens', () => {
    // Pasting an address copied out of a payment you RECEIVED — which is the
    // sender's address, not yours.
    expect(read('lib/i18n/en.ts')).toMatch(/not one you copied from a payment you were sent/);
    expect(read('lib/i18n/ar.ts')).toMatch(/نسخته من دفعة اتبعتت لك/);
  });

  it('the route sends ONLY the address — never an owner', () => {
    // A route that can name whose claim to edit is a route that can redirect
    // somebody else's reward.
    expect(route).toMatch(/JSON\.stringify\(\{ wallet_address: input\.wallet_address \}\)/);
    expect(route).not.toMatch(/owner|username|pi_uid/);
    expect(route).toContain('requireAuth: true');
  });

  it('carries the service’s own message on failure', () => {
    expect(route).toMatch(/data\?\.message \?\? data\?\.error/);
  });
});

describe('the payout queue is built for copying by hand', () => {
  const page = read('app/hub/admin/campaign/page.tsx');

  it('renders the address monospaced with a copy button', () => {
    // It is retyped into a wallet app by a human; a mis-copied character sends
    // real Pi to a stranger with no way back.
    expect(page).toMatch(/font-mono/);
    expect(page).toMatch(/navigator\.clipboard\.writeText\(claim\.wallet_address\)/);
  });

  it('refuses "mark sent" unless the id LOOKS like a transaction hash', () => {
    // The rule used to be "not empty", and `1` passed it: a claim was marked
    // PAID and the claimant was told "Sent — 1 π on its way, check your Pi
    // wallet" while nothing had left any wallet. This field is the evidence
    // that the transfer happened; one that takes any characters is not
    // evidence, it is a checkbox with extra steps.
    expect(page).toContain('/^[0-9a-fA-F]{64}$/');
    expect(page).toMatch(/not a transaction hash/);
  });

  it('offers a button that actually SENDS, and one that only records', () => {
    // They sit next to each other and only one of them moves money. A person
    // who mistakes the second for the first records a payment that never
    // happened and tells the claimant to go and look for it — which is exactly
    // what happened with `tx: 1`.
    expect(page).toMatch(/Send \$\{claim\.amount_pi\} π now/);
    expect(page).toMatch(/<strong>Send now<\/strong> transfers the Pi/);
    expect(page).toMatch(/<strong>Mark sent<\/strong> only records one you already sent/);
  });

  it('a wrongly-paid claim can be put back in the queue, in TWO taps', () => {
    // The mistake this undoes actually happened: a claim marked PAID with a
    // transaction id of `1`. Without it the only remedy is editing the row by
    // hand — Forbidden Behavior #1 and #10 — so the governed path is what stops
    // the rule being broken, not a loosening of it.
    //
    // Two taps because what it enables is paying twice, and the second label
    // says what the tap will do.
    expect(page).toMatch(/Not actually paid\? Put it back in the queue/);
    expect(page).toMatch(/Confirm — put it back in the queue/);
    expect(page).toContain('armedUnpaid');
  });

  it('warns that it claws nothing back', () => {
    // If the Pi really did move, the record stops matching the chain — and the
    // next payout sends it again.
    expect(page).toMatch(/does not claw anything back/);
  });

  it('the send action is a CLOSED set, never the caller’s string', () => {
    // One of these moves Pi. An action taken from the body unchecked would let
    // a request reach any path segment under the claim.
    const route = codeOf('app/api/admin/campaign/claims/route.ts');
    expect(route).toMatch(/const ACTIONS = \[/);
    expect(route).toMatch(/'send'/);
    expect(route).toMatch(/if \(!action\)/);
  });

  it('says whether the payout wallet can actually send, before anything spends it', () => {
    // Setting it up is the one part of this path done by hand, in a dashboard,
    // from a value that cannot be read back. Without this line the only way to
    // learn it has a typo is to attempt a real payout and read the failure.
    expect(page).toMatch(/No payout wallet — “Send now” cannot send anything/);
    // The PUBLIC key, so it can be compared against the wallet that was funded.
    expect(page).toMatch(/Check this is the wallet you funded/);
    // And the service's own diagnosis, not a generic "not configured".
    expect(page).toMatch(/wallet\.problem/);
  });

  it('does not offer "Send now" when there is no wallet to send from', () => {
    // A control the system cannot honour is worse than no control: it fails on
    // the tap, and the failure looks like the platform being broken rather than
    // a wallet not being set up.
    expect(page).toMatch(/disabled=\{busy \|\| !canSend\}/);
    expect(page).toMatch(/No payout wallet is configured on payment-service/);
  });

  it('makes the hand-sent path the primary one while that is true', () => {
    // Sending by hand is not a fallback until an app wallet exists — it is the
    // whole way this works, and a screen whose only prominent button is dead
    // teaches people the page is broken.
    expect(page).toMatch(/Send now<\/strong> needs an app wallet/);
    expect(page).toMatch(/canSend\s*\n?\s*\? 'var\(--tec-fill-soft\)'/);
  });

  it('an unknown wallet status does not disable the working button', () => {
    // A status line that failed to load must not take the payout button with
    // it. The service refuses either way; this only decides which control leads.
    expect(page).toMatch(/canSend=\{wallet\?\.configured !== false\}/);
  });

  it('the wallet route forwards the SESSION, not a service credential', () => {
    // identity-service reads x-internal-key as a ServiceActor credential and
    // skips the role check — and this answer reaches payment-service.
    const route = codeOf('app/api/admin/campaign/payout-wallet/route.ts');
    expect(route).not.toContain('x-internal-key');
    expect(route).not.toContain('INTERNAL_SECRET');
    expect(route).toMatch(/if \(!token\) return NextResponse\.json\(\s*\{ error: 'Unauthorized' \}/);
  });

  it('hides itself from non-admins', () => {
    expect(page).toContain("?.role === 'admin'");
    expect(page).toContain('Access restricted');
  });
});

// ── The Hub spotlight ───────────────────────────────────────────────────────

describe('the carousel slide appears only while a round is open', () => {
  const carousel = codeOf('components/hub/HubCarousel.tsx');
  const hub      = codeOf('app/hub/page.tsx');

  it('renders the campaign slide conditionally', () => {
    // A slide advertising a campaign that has ended is a dead promise on the
    // Hub's most prominent surface.
    expect(carousel).toMatch(/const showCampaign = campaignOpen && typeof goToCampaign === 'function'/);
    expect(carousel).toMatch(/\{showCampaign && \(/);
  });

  it('moves the slide COUNT with it', () => {
    // The count used to be the constant 3. A stale count either lets a swipe
    // land on a slide that is not there, or makes the last one unreachable —
    // both look like a broken carousel rather than a finished campaign.
    expect(carousel).toMatch(/const SLIDES = showCampaign \? 4 : 3/);
    expect(carousel).not.toMatch(/^const SLIDES = 3;$/m);
  });

  it('CLAMPS the index, because the count can shrink under a viewer', () => {
    // A round ends while someone is parked on the last slide; an unclamped
    // index then points past the track and the spotlight goes blank.
    expect(carousel).toMatch(/const idx = Math\.min\(Math\.max\(carouselIdx, 0\), SLIDES - 1\)/);
    expect(carousel).toMatch(/translateX\(\$\{rtl \? '' : '-'\}\$\{idx \* 100\}%\)/);
  });

  it('uses the clamped index for the dots too', () => {
    // Otherwise the track and its indicator disagree about where you are.
    expect(carousel).not.toMatch(/carouselIdx === i/);
    expect(carousel).toMatch(/idx === i/);
  });

  it('the Hub treats an unreadable status as CLOSED', () => {
    // The Hub must not headline Pi it cannot confirm is on offer (P6).
    expect(hub).toMatch(/setCampaignOpen\(j\?\.data\?\.open === true\)/);
    expect(hub).toMatch(/useState\(false\)/);
  });

  it('does not leave a setState behind after unmount', () => {
    expect(hub).toMatch(/let alive = true;[\s\S]*?return \(\) => \{ alive = false; \};/);
  });
});

describe('the status request stays out of the payment path', () => {
  const hub = codeOf('app/hub/page.tsx');

  it('is skipped during a Hub payment', () => {
    // `/hub?pay=1&…` renders PaymentPreparing and then the modal — the carousel
    // never appears, so the request is pure waste on the one screen where an
    // extra round trip is most expensive. It also stopped three payment-flow
    // tests passing, which is how it was noticed.
    expect(hub).toMatch(/get\('pay'\) === '1'\) return;/);
  });

  it('declares its hooks ABOVE the early returns', () => {
    // Two early returns sit lower in this component (HubSkeleton and
    // PaymentPreparing). A hook below them is called conditionally, and React
    // fails the whole page with "Rendered fewer hooks than expected".
    const hookAt   = hub.indexOf('setCampaignOpen');
    const firstRet = hub.indexOf('return <HubSkeleton />');
    expect(hookAt).toBeGreaterThan(-1);
    expect(firstRet).toBeGreaterThan(-1);
    expect(hookAt).toBeLessThan(firstRet);
  });
});

describe('a mission actually records the visit', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('POSTs the open when a mission link is clicked', () => {
    // Regression: the missions were plain <a> links that recorded NOTHING. The
    // campaign reads the same PioneerQuest.opened_apps the Founding Quest
    // writes — so a pioneer could open all eight apps, stay at zero, and never
    // reach the claim form. A campaign whose missions cannot be completed is
    // worse than a closed one: it looks open.
    expect(page).toContain("fetch('/api/bff/pioneer/open'");
    expect(page).toMatch(/onClick=\{\(\) => onOpen\(slug\)\}/);
    expect(page).toMatch(/onOpen=\{recordOpen\}/);
  });

  it('uses keepalive, because the mission navigates away', () => {
    // A fetch in flight when the tab navigates is cancelled — the exact way the
    // Founding open was lost before.
    expect(page).toMatch(/keepalive:\s*true/);
  });

  it('sends the CSRF token', () => {
    expect(page).toContain('tec_csrf');
    expect(page).toContain('x-csrf-token');
  });

  it('re-reads progress when the pioneer comes back to the tab', () => {
    // Missions open in a new tab, so this page never unmounts and never
    // re-fetches: the ticks would stay empty until a manual reload, which reads
    // as "my visit did not count" exactly when it did.
    expect(page).toMatch(/addEventListener\('focus'/);
    expect(page).toMatch(/removeEventListener\('focus'/);
  });

  it('never ticks a mission optimistically', () => {
    // `connection` requires a message SENT, not a tab opened. A hopeful ✅ there
    // would be a lie the claim button then refuses to honour — the server stays
    // the only authority on what is done.
    expect(page).toMatch(/done=\{me\?\.done\.includes\(slug\) \?\? false\}/);
  });
});

describe('the Connection mission points at the TEC group', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('sends Connection to the invite link, not just to the app', () => {
    // The invite joins the pioneer in ONE tap with nobody to approve it. Saying
    // "send a message in the TEC group" without saying where the group is turns
    // a one-tap mission into a search.
    expect(page).toMatch(/slug !== 'connection'\) return linkFor\(slug\)/);
    expect(page).toContain('connection_invite_url');
    expect(page).toMatch(/href=\{hrefFor\(slug\)\}/);
  });

  it('falls back to the app when no invite is configured', () => {
    // A mission that sends someone to a broken URL is worse than one that sends
    // them to the app and lets them find the group.
    expect(page).toMatch(/me\?\.connection_invite_url \|\| status\?\.connection_invite_url \|\| linkFor\(slug\)/);
  });

  it('hands the mission its hint, and the hint says what to post — in both languages', () => {
    // The mission IS the address now: the group is where it is said, and the
    // link is what puts them in the group. The wiring is asserted against the
    // component, the sentence against the copy — and against BOTH locales,
    // because a pioneer reading the Arabic page must be told where to post it
    // just as plainly as one reading the English.
    expect(page).toMatch(/hintConnection=\{c\.missionConnection\}/);
    expect(read('lib/i18n/en.ts')).toMatch(/puts you in the TEC group/);
    expect(read('lib/i18n/en.ts')).toMatch(/post your Pi wallet address there/i);
    expect(read('lib/i18n/ar.ts')).toMatch(/جروب TEC/);
    expect(read('lib/i18n/ar.ts')).toMatch(/عنوان محفظة/);
  });
});

describe('a mission remembers where the pioneer was', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('stashes /hub/campaign before the mission navigates away', () => {
    // Reported from a phone: leaving an app landed on the sign-in page rather
    // than back on the campaign. A mission goes to another tecosystem.app app,
    // which may bounce through the Hub's SSO to resolve its own session —
    // coming back walks into the middle of that chain. The Hub already knows
    // how to forward a remembered destination; nothing was telling it where the
    // person had been standing.
    expect(page).toMatch(/rememberReturn\('\/hub\/campaign'\)/);
    expect(page).toContain("from '@/lib-client/return-to'");
  });

  it('remembers BEFORE the record fetch, not after', () => {
    // The navigation can begin the moment the click is handled. A stash queued
    // behind a network call is a stash that may never happen.
    const code = page.slice(page.indexOf('const recordOpen'));
    expect(code.indexOf('rememberReturn')).toBeLessThan(code.indexOf('fetch('));
  });
});

describe('the payout queue is reachable from the campaign itself', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('shows an admin an entry point to /hub/admin/campaign', () => {
    // Reachable from Profile too, but a link there is a detour when you are
    // standing on this page wondering who has claimed.
    expect(page).toContain("/hub/admin/campaign");
    expect(page).toMatch(/isAdmin && \(/);
  });

  it('gates it on the role, and only shows it', () => {
    // The route and the service both check again, and they are the ones that
    // decide (P5) — this hides a button, it does not grant anything.
    expect(page).toMatch(/role\?: string \} \| null\)\?\.role === 'admin'/);
  });
});

describe('a rejected pioneer is offered another go', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('does not treat a REJECTED claim as an active one', () => {
    // The service was changed to allow a second claim after a rejection. This
    // page still gated the missions on ANY claim, so the rejected pioneer met
    // a dead end: the notice, and nothing to do about it.
    expect(page).toMatch(/claim\.status !== 'REJECTED' \? claim : null/);
    expect(page).toMatch(/!activeClaim && status\?\.open && \(/);
  });

  it('tells them what to DO, not just who to contact — in both languages', () => {
    // "Contact us" alone, on a screen with no way forward, reads as a polite no.
    // A rejected pioneer reading Arabic is the one most likely to read it that
    // way, so the second chance is asserted there too.
    expect(page).toMatch(/c\.rejectedBody/);
    expect(read('lib/i18n/en.ts')).toMatch(/try again below/i);
    expect(read('lib/i18n/ar.ts')).toMatch(/تحاول تاني/);
  });
});

describe('a claim keeps its record when the round ends', () => {
  const page = codeOf('app/hub/campaign/page.tsx');

  it('shows "no campaign" only to somebody with NO claim at all', () => {
    // Keying this on `activeClaim` hid a rejected pioneer's own notice the
    // moment the round closed — the record of what happened to them gone, with
    // nothing in its place. A regression from the fix one commit earlier.
    expect(page).toMatch(/!status\?\.open && !claim \?/);
  });

  it('offers the form only while a round is open', () => {
    // The missions come back for a rejected pioneer, but a closed campaign
    // would invite a claim the service refuses — and being refused twice reads
    // as being refused personally.
    expect(page).toMatch(/!activeClaim && status\?\.open && \(/);
  });
});
