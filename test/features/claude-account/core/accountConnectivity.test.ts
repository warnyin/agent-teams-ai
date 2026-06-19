// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  isAccessTokenExpired,
  mapConnectivityFromAuthStatus,
  parseCredentialToken,
} from '@features/claude-account/core/domain/accountConnectivity';

describe('parseCredentialToken', () => {
  it('reads the claudeAiOauth access token and ms expiry', () => {
    const raw = JSON.stringify({
      claudeAiOauth: { accessToken: 'tok_abc', expiresAt: 1_700_000_000_000 },
    });
    expect(parseCredentialToken(raw)).toEqual({
      accessToken: 'tok_abc',
      expiresAtMs: 1_700_000_000_000,
    });
  });

  it('normalizes a seconds expiry to milliseconds', () => {
    const raw = JSON.stringify({ claudeAiOauth: { accessToken: 'tok', expiresAt: 1_700_000_000 } });
    expect(parseCredentialToken(raw).expiresAtMs).toBe(1_700_000_000_000);
  });

  it('falls back to snake_case fields and a flat shape', () => {
    const raw = JSON.stringify({ access_token: 'tok_flat' });
    expect(parseCredentialToken(raw)).toEqual({ accessToken: 'tok_flat', expiresAtMs: null });
  });

  it('returns nulls for malformed or empty input', () => {
    expect(parseCredentialToken('not json')).toEqual({ accessToken: null, expiresAtMs: null });
    expect(parseCredentialToken('{}')).toEqual({ accessToken: null, expiresAtMs: null });
    expect(parseCredentialToken(JSON.stringify({ claudeAiOauth: { accessToken: '' } }))).toEqual({
      accessToken: null,
      expiresAtMs: null,
    });
  });
});

describe('isAccessTokenExpired', () => {
  const now = 1_700_000_000_000;

  it('is false for a token comfortably in the future', () => {
    expect(isAccessTokenExpired(now + 10 * 60_000, now)).toBe(false);
  });

  it('is true at/after expiry including the skew window', () => {
    expect(isAccessTokenExpired(now, now)).toBe(true);
    expect(isAccessTokenExpired(now + 30_000, now)).toBe(true); // within 60s skew
  });

  it('is false when expiry is unknown', () => {
    expect(isAccessTokenExpired(null, now)).toBe(false);
  });
});

describe('mapConnectivityFromAuthStatus', () => {
  it('treats 401/403 as invalid', () => {
    expect(mapConnectivityFromAuthStatus(401)).toBe('invalid');
    expect(mapConnectivityFromAuthStatus(403)).toBe('invalid');
  });

  it('treats accepted-auth responses (2xx/400/429) as valid', () => {
    expect(mapConnectivityFromAuthStatus(200)).toBe('valid');
    expect(mapConnectivityFromAuthStatus(400)).toBe('valid');
    expect(mapConnectivityFromAuthStatus(429)).toBe('valid');
  });

  it('treats server errors and network failures as unknown', () => {
    expect(mapConnectivityFromAuthStatus(500)).toBe('unknown');
    expect(mapConnectivityFromAuthStatus(503)).toBe('unknown');
    expect(mapConnectivityFromAuthStatus(null)).toBe('unknown');
  });
});
