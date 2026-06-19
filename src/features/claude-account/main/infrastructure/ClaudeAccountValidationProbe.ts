import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type AccountConnectivity,
  isAccessTokenExpired,
  mapConnectivityFromAuthStatus,
  parseCredentialToken,
} from '@features/claude-account/core/domain/accountConnectivity';

import type { ValidationProbePort } from '@features/claude-account/core/application/ports';

const CREDENTIALS_FILE = '.credentials.json';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/** Beta header required for subscription OAuth tokens (see the Claude Code OAuth flow). */
const ANTHROPIC_OAUTH_BETA = 'oauth-2025-04-20';
const DEFAULT_VALIDATION_TIMEOUT_MS = 8_000;

export interface ClaudeAccountValidationProbeDeps {
  /** Reads a file as UTF-8, or returns null when it does not exist / cannot be read. */
  readCredentialsFile?: (path: string) => Promise<string | null>;
  /**
   * Sends an auth-only request and returns the HTTP status, or null on network error/timeout.
   * Injected so unit tests never hit the network.
   */
  checkAuth?: (accessToken: string) => Promise<number | null>;
  now?: () => number;
  timeoutMs?: number;
}

async function defaultReadCredentialsFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Verifies an account's stored OAuth token against the API. Sends an intentionally-empty
 * `POST /v1/messages`: a closed/revoked account returns 401 (auth checked first), while a
 * valid account returns 400 ("model: Field required") — so the token is verified WITHOUT
 * consuming any inference tokens. A token that is already expired is treated as `unknown`
 * (a 401 from it would be ambiguous: revoked vs. merely needing a refresh).
 */
export class ClaudeAccountValidationProbe implements ValidationProbePort {
  private readonly readCredentialsFile: (path: string) => Promise<string | null>;
  private readonly checkAuth: (accessToken: string) => Promise<number | null>;
  private readonly now: () => number;
  private readonly timeoutMs: number;

  constructor(deps: ClaudeAccountValidationProbeDeps = {}) {
    this.readCredentialsFile = deps.readCredentialsFile ?? defaultReadCredentialsFile;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_VALIDATION_TIMEOUT_MS;
    this.checkAuth = deps.checkAuth ?? ((accessToken) => this.requestAuthStatus(accessToken));
    this.now = deps.now ?? (() => Date.now());
  }

  async probe(configDir: string): Promise<AccountConnectivity> {
    const raw = await this.readCredentialsFile(join(configDir, CREDENTIALS_FILE));
    if (!raw) {
      return 'unknown';
    }
    const { accessToken, expiresAtMs } = parseCredentialToken(raw);
    if (!accessToken || isAccessTokenExpired(expiresAtMs, this.now())) {
      return 'unknown';
    }
    const httpStatus = await this.checkAuth(accessToken);
    return mapConnectivityFromAuthStatus(httpStatus);
  }

  private async requestAuthStatus(accessToken: string): Promise<number | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-beta': ANTHROPIC_OAUTH_BETA,
          'content-type': 'application/json',
        },
        // Empty body — auth is validated before body, so this never bills inference.
        body: '{}',
        signal: controller.signal,
      });
      return response.status;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
