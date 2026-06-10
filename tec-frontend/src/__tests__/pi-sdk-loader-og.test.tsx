/**
 * PiSdkLoader (real component) — init throw, timeout, pageshow re-init.
 * opengraph-image — ImageResponse construction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';

const mockImageResponse = vi.hoisted(() => vi.fn());
vi.mock('next/og', () => ({
  ImageResponse: mockImageResponse,
}));

import PiSdkLoader from '@/components/PiSdkLoader';
import OGImage, { alt, size, contentType } from '@/app/opengraph-image';

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as any).Pi;
  delete (window as any).__TEC_PI_READY;
  delete (window as any).__TEC_PI_ERROR;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PiSdkLoader', () => {
  it('inits immediately when Pi present and fires tec-pi-ready', () => {
    const init = vi.fn();
    (window as any).Pi = { init };
    const onReady = vi.fn();
    const readyListener = vi.fn();
    window.addEventListener('tec-pi-ready', readyListener);

    render(<PiSdkLoader sandbox timeout={5000} onReady={onReady} />);

    expect(init).toHaveBeenCalledWith(expect.objectContaining({ version: '2.0', sandbox: true }));
    expect((window as any).__TEC_PI_READY).toBe(true);
    expect(onReady).toHaveBeenCalled();
    expect(readyListener).toHaveBeenCalled();
    window.removeEventListener('tec-pi-ready', readyListener);
  });

  it('treats "already initialized" throw as success', () => {
    (window as any).Pi = {
      init: vi.fn(() => { throw new Error('Pi already initialized'); }),
    };
    render(<PiSdkLoader sandbox={false} timeout={5000} />);
    expect((window as any).__TEC_PI_READY).toBe(true);
  });

  it('does not mark ready when init throws a different error', () => {
    vi.useFakeTimers();
    (window as any).Pi = {
      init: vi.fn(() => { throw new Error('bridge unavailable'); }),
    };
    render(<PiSdkLoader sandbox={false} timeout={5000} />);
    expect((window as any).__TEC_PI_READY).toBeUndefined();
  });

  it('sets __TEC_PI_ERROR and fires tec-pi-error after timeout without Pi', async () => {
    vi.useFakeTimers();
    const errorListener = vi.fn();
    window.addEventListener('tec-pi-error', errorListener);

    render(<PiSdkLoader sandbox timeout={1000} />);
    await act(async () => { vi.advanceTimersByTime(1500); });

    expect((window as any).__TEC_PI_ERROR).toBe(true);
    expect(errorListener).toHaveBeenCalled();
    window.removeEventListener('tec-pi-error', errorListener);
  });

  it('poll detects Pi appearing before timeout', async () => {
    vi.useFakeTimers();
    render(<PiSdkLoader sandbox timeout={10000} />);
    (window as any).Pi = { init: vi.fn() };
    await act(async () => { vi.advanceTimersByTime(600); });
    expect((window as any).__TEC_PI_READY).toBe(true);
    expect((window as any).__TEC_PI_ERROR).toBeUndefined();
  });

  it('re-inits on bfcache pageshow restore', () => {
    const init = vi.fn();
    (window as any).Pi = { init };
    render(<PiSdkLoader sandbox timeout={5000} />);
    expect(init).toHaveBeenCalledTimes(1);

    const evt = new Event('pageshow');
    Object.defineProperty(evt, 'persisted', { value: true });
    act(() => { window.dispatchEvent(evt); });

    expect(init).toHaveBeenCalledTimes(2);
    expect((window as any).__TEC_PI_READY).toBe(true);
  });
});

describe('opengraph-image', () => {
  it('exports metadata constants', () => {
    expect(alt).toContain('TEC');
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
  });

  it('builds an ImageResponse with the OG layout', () => {
    mockImageResponse.mockImplementation(function (this: any) { return this; });
    OGImage();
    expect(mockImageResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1200, height: 630 }),
    );
  });
});
