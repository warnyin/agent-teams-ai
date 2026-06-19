/**
 * Pure helpers for the live account-connectivity check that catches accounts which look
 * connected locally (a valid-looking cached OAuth token exists) but are actually revoked or
 * closed server-side. `claude auth status` only inspects the local token, so a closed account
 * keeps reporting `loggedIn: true` until the cached access token expires. A direct
 * authenticated request to the API returns 401 for such accounts even before expiry.
 */

export type AccountConnectivity = 'valid' | 'invalid' | 'unknown';

interface ParsedCredentialToken {
  accessToken: string | null;
  /** Access-token expiry in epoch milliseconds, or null when unknown. */
  expiresAtMs: number | null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeExpiryMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

/**
 * Extracts the OAuth access token and its expiry from a `.credentials.json` payload. Returns
 * nulls when the shape is unexpected so callers degrade to `unknown` instead of throwing.
 */
export function parseCredentialToken(rawJson: string): ParsedCredentialToken {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { accessToken: null, expiresAtMs: null };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { accessToken: null, expiresAtMs: null };
  }
  const record = parsed as Record<string, unknown>;
  const oauth = (record.claudeAiOauth ?? record.oauth ?? record) as Record<string, unknown>;
  return {
    accessToken: asNonEmptyString(oauth.accessToken) ?? asNonEmptyString(oauth.access_token),
    expiresAtMs: normalizeExpiryMs(oauth.expiresAt ?? oauth.expires_at),
  };
}

/** True when the access token is at/after expiry (with a small skew); such a token may simply
 * need a refresh, so a 401 from it is not proof the account is closed. */
export function isAccessTokenExpired(
  expiresAtMs: number | null,
  nowMs: number,
  skewMs = 60_000
): boolean {
  return expiresAtMs !== null && expiresAtMs <= nowMs + skewMs;
}

/**
 * Maps the auth-check HTTP outcome to a connectivity verdict. Only an unambiguous auth
 * rejection (401/403) on an unexpired token yields `invalid`; everything else that proves the
 * token was accepted (2xx/4xx other than 401/403, e.g. 400 for our intentionally-empty body)
 * is `valid`; server errors and network failures stay `unknown` to avoid false downgrades.
 */
export function mapConnectivityFromAuthStatus(httpStatus: number | null): AccountConnectivity {
  if (httpStatus === null) {
    return 'unknown';
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return 'invalid';
  }
  if (httpStatus >= 200 && httpStatus < 500) {
    return 'valid';
  }
  return 'unknown';
}
