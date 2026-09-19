import { describe, expect, it } from 'vitest';
import { resolveForgeApiUrl } from './forgeApi';

describe('resolveForgeApiUrl', () => {
  it('defaults to same-origin relative /api paths when base is unset', () => {
    expect(resolveForgeApiUrl('/api/auth/session', undefined)).toBe('/api/auth/session');
    expect(resolveForgeApiUrl('/api/mining/summary', '')).toBe('/api/mining/summary');
    expect(resolveForgeApiUrl('/api/mining/summary', '   ')).toBe('/api/mining/summary');
  });

  it('honors optional VITE_FORGE_API_BASE_URL override without trailing slash', () => {
    expect(resolveForgeApiUrl('/api/auth/session', 'https://forge-api.example.com')).toBe(
      'https://forge-api.example.com/api/auth/session',
    );
    expect(resolveForgeApiUrl('/api/auth/logout', 'https://forge-api.example.com/')).toBe(
      'https://forge-api.example.com/api/auth/logout',
    );
  });
});
