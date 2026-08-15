import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './client';

describe('resolveApiBaseUrl', () => {
  it('uses the same-origin proxy when no public API URL is configured', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('/api');
  });

  it('does not expose localhost as an API destination to external browsers', () => {
    expect(resolveApiBaseUrl('http://localhost:3001')).toBe('/api');
    expect(resolveApiBaseUrl('https://127.0.0.1:3001/')).toBe('/api');
  });

  it('keeps an explicit non-local API URL and normalizes its trailing slash', () => {
    expect(resolveApiBaseUrl('https://api.example.test/')).toBe('https://api.example.test');
  });
});
