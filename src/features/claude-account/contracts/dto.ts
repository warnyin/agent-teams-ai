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
