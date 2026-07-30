import { describe, it, expect } from 'vitest';
import { NAV_TARGETS, ACTION_TARGETS, parseNavIntents } from '@/lib/ai/nav-intents';

describe('NAV_TARGETS (derived from the domain registry)', () => {
  it('exposes live apps keyed by slug', () => {
    expect(NAV_TARGETS.commerce).toBeDefined();
    expect(NAV_TARGETS.zone).toBeDefined();
    expect(NAV_TARGETS.tec).toBeDefined();
  });

  it('carries the registry route and bilingual name', () => {
    expect(NAV_TARGETS.commerce.href).toMatch(/^https?:\/\//);
    expect(NAV_TARGETS.tec.href).toBe('/hub');           // Hub is an internal path
    expect(NAV_TARGETS.zone.name.en).toBeTruthy();
    expect(NAV_TARGETS.zone.name.ar).toBeTruthy();
  });
});

describe('parseNavIntents', () => {
  it('extracts a single marker, strips it, and resolves the target', () => {
    const { clean, intents } = parseNavIntents('Open the marketplace to sell with Pi.\n[[go:commerce]]');
    expect(clean).toBe('Open the marketplace to sell with Pi.');
    expect(intents).toHaveLength(1);
    expect(intents[0].slug).toBe('commerce');
    expect(intents[0].href).toBe(NAV_TARGETS.commerce.href);
    expect(intents[0].label).toBeUndefined();
  });

  it('honors a custom label after the pipe', () => {
    const { intents } = parseNavIntents('Try Zone. [[go:zone|Check verification]]');
    expect(intents[0].label).toBe('Check verification');
  });

  it('drops an unknown slug but keeps the prose', () => {
    const { clean, intents } = parseNavIntents('Here you go. [[go:not-an-app]]');
    expect(clean).toBe('Here you go.');
    expect(intents).toHaveLength(0);
  });

  it('de-duplicates repeated slugs', () => {
    const { intents } = parseNavIntents('a [[go:zone]] b [[go:zone]]');
    expect(intents).toHaveLength(1);
  });

  it('returns no intents and trimmed prose when there is no marker', () => {
    const { clean, intents } = parseNavIntents('  just a normal answer  ');
    expect(clean).toBe('just a normal answer');
    expect(intents).toHaveLength(0);
  });

  it('is case-insensitive on the slug', () => {
    const { intents } = parseNavIntents('go [[GO:Commerce]]');
    expect(intents).toHaveLength(1);
    expect(intents[0].slug).toBe('commerce');
  });
});

describe('parseNavIntents — Hub action deep-links', () => {
  it('resolves a Hub action marker to its deep-link + action', () => {
    const { clean, intents } = parseNavIntents('Tap below to pay. [[go:tec:pay]]');
    expect(clean).toBe('Tap below to pay.');
    expect(intents).toHaveLength(1);
    expect(intents[0].slug).toBe('tec');
    expect(intents[0].action).toBe('pay');
    expect(intents[0].href).toBe(ACTION_TARGETS['tec:pay'].href);   // /hub?pay=1
  });

  it('resolves kyc / subscribe / send actions', () => {
    expect(parseNavIntents('[[go:tec:kyc]]').intents[0].href).toBe('/hub/kyc');
    expect(parseNavIntents('[[go:tec:subscribe]]').intents[0].href).toBe('/hub/subscription');
    expect(parseNavIntents('[[go:tec:send]]').intents[0].href).toBe('/dashboard/wallet?action=send');
  });

  it('drops an unknown action instead of falling back to the app home', () => {
    const { intents } = parseNavIntents('[[go:tec:teleport]]');
    expect(intents).toHaveLength(0);
  });

  it('keeps an app-level and an action-level intent as distinct', () => {
    const { intents } = parseNavIntents('a [[go:tec:pay]] b [[go:commerce]]');
    expect(intents).toHaveLength(2);
    expect(intents.map(i => i.action)).toEqual(['pay', undefined]);
  });

  it('honors a custom label after an action marker', () => {
    const { intents } = parseNavIntents('[[go:tec:pay|Pay now]]');
    expect(intents[0].action).toBe('pay');
    expect(intents[0].label).toBe('Pay now');
  });
});

describe('parseNavIntents — multi-step flows', () => {
  it('parses an ordered flow across apps, stripping the marker', () => {
    const { clean, flows, intents } = parseNavIntents(
      "Here's the path. [[flow: nbf|Register your business ; commerce|List your product ; explorer]]",
    );
    expect(clean).toBe("Here's the path.");
    expect(intents).toHaveLength(0);              // flow steps are not also single intents
    expect(flows).toHaveLength(1);
    expect(flows[0].steps.map(s => s.slug)).toEqual(['nbf', 'commerce', 'explorer']);
    expect(flows[0].steps[0].label).toBe('Register your business');
  });

  it('resolves action steps inside a flow', () => {
    const { flows } = parseNavIntents('[[flow: tec:kyc ; tec:subscribe ]]');
    expect(flows[0].steps.map(s => s.href)).toEqual(['/hub/kyc', '/hub/subscription']);
  });

  it('drops unknown steps but keeps the flow if ≥2 remain', () => {
    const { flows } = parseNavIntents('[[flow: nbf ; not-an-app ; commerce]]');
    expect(flows[0].steps.map(s => s.slug)).toEqual(['nbf', 'commerce']);
  });

  it('discards a flow that resolves to fewer than 2 valid steps', () => {
    const { flows } = parseNavIntents('[[flow: nbf ; not-an-app]]');
    expect(flows).toHaveLength(0);
  });

  it('accepts ">" as a step separator', () => {
    const { flows } = parseNavIntents('[[flow: nbf > commerce]]');
    expect(flows[0].steps).toHaveLength(2);
  });
});
