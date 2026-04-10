import { generateRequestId, buildHeaders, storeRequestId, getLastRequestId } from '../request-id';

describe('request-id', () => {

  describe('generateRequestId', () => {
    it('returns a valid UUID v4', () => {
      const id = generateRequestId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('returns unique IDs on each call', () => {
      const ids = new Set(Array.from({ length: 10 }, () => generateRequestId()));
      expect(ids.size).toBe(10);
    });
  });

  describe('buildHeaders', () => {
    it('returns Content-Type and X-Request-ID by default', () => {
      const headers = buildHeaders();
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Request-ID']).toBeDefined();
      expect(headers['X-Request-ID']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('includes Authorization header when token provided', () => {
      const headers = buildHeaders('my-token');
      expect(headers['Authorization']).toBe('Bearer my-token');
    });

    it('does not include Authorization when token is null', () => {
      const headers = buildHeaders(null);
      expect(headers['Authorization']).toBeUndefined();
    });

    it('does not include Authorization when token is undefined', () => {
      const headers = buildHeaders(undefined);
      expect(headers['Authorization']).toBeUndefined();
    });

    it('merges extra headers', () => {
      const headers = buildHeaders(null, { 'x-custom': 'value' });
      expect(headers['x-custom']).toBe('value');
    });

    it('extra headers override defaults', () => {
      const headers = buildHeaders(null, { 'Content-Type': 'text/plain' });
      expect(headers['Content-Type']).toBe('text/plain');
    });

    it('generates unique X-Request-ID on each call', () => {
      const h1 = buildHeaders();
      const h2 = buildHeaders();
      expect(h1['X-Request-ID']).not.toBe(h2['X-Request-ID']);
    });
  });

  describe('storeRequestId + getLastRequestId', () => {
    it('stores and retrieves requestId from sessionStorage', () => {
      storeRequestId('test-id-123');
      expect(getLastRequestId()).toBe('test-id-123');
    });

    it('returns null when sessionStorage is empty', () => {
      sessionStorage.clear();
      expect(getLastRequestId()).toBeNull();
    });

    it('overwrites previous requestId', () => {
      storeRequestId('first-id');
      storeRequestId('second-id');
      expect(getLastRequestId()).toBe('second-id');
    });
  });
});
