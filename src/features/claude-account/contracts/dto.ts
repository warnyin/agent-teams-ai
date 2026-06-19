export type ClaudeAccountPlan = 'free' | 'pro' | 'max' | 'team' | 'enterprise' | 'unknown';

export type ClaudeAccountAuthKind = 'subscription' | 'api_key' | 'bedrock' | 'unknown';

export type ClaudeAccountLoginStatus = 'logged_in' | 'logged_out' | 'unknown';

/**
 * A single Claude account, identified by its `CLAUDE_CONFIG_DIR`.
 * One config directory holds one account's credentials, so a config dir IS an account.
 */
export interface ClaudeAccountDto {
  /** Stable id derived from the normalized config dir. */
  id: string;
  /** Human-readable label derived from the dir name (e.g. "Default", "Max1", "Pro"). */
  label: string;
  /** Absolute path to the account's CLAUDE_CONFIG_DIR. */
  configDir: string;
  /** True when this is the auto-detected default (`~/.claude`); such accounts must bind to a null override. */
  isDefault: boolean;
  loginStatus: ClaudeAccountLoginStatus;
  email: string | null;
  plan: ClaudeAccountPlan;
  authKind: ClaudeAccountAuthKind;
  orgName: string | null;
  /** True when a `.credentials.json` exists for this config dir. */
  hasCredentials: boolean;
}

export interface ClaudeAccountSnapshotDto {
  accounts: ClaudeAccountDto[];
  /** The auto-detected default config dir (`~/.claude`). */
  defaultConfigDir: string;
  updatedAt: string;
}

/**
 * One subscription usage window for an account (e.g. the 5h or weekly limit), ready for
 * display. Derived per-account by probing that account's runtime (see getClaudeAccountUsage).
 */
export interface ClaudeAccountUsageWindowDto {
  /** Percent of the window consumed, 0..100. */
  usedPercent: number;
  /** When the window resets, in epoch milliseconds, or null when unknown. */
  resetsAtMs: number | null;
  /** Short window label, e.g. "5h", "Weekly". */
  label: string;
}

/**
 * Per-account usage probed lazily for one `CLAUDE_CONFIG_DIR`. `windows` is empty when usage
 * is unavailable (probe failed/timed out, account is API-key/signed-out, or not applicable).
 */
export interface ClaudeAccountUsageDto {
  configDir: string;
  windows: ClaudeAccountUsageWindowDto[];
}

/**
 * Live connectivity verdict for one account, from a server-side credential check:
 * - `valid`   — the access token authenticates against the API.
 * - `invalid` — the token was rejected (401/403) while still unexpired ⇒ revoked/closed account.
 * - `unknown` — could not determine (no creds, token already expired, network/server error).
 *   `unknown` must NEVER downgrade the card — `auth status` remains the source of truth.
 */
export type ClaudeAccountConnectivity = 'valid' | 'invalid' | 'unknown';

export interface ClaudeAccountValidationDto {
  configDir: string;
  result: ClaudeAccountConnectivity;
}
