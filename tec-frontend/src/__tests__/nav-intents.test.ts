import { describe, it, expect } from 'vitest';
import { NAV_TARGETS, parseNavIntents } from '@/lib/ai/nav-intents';

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
