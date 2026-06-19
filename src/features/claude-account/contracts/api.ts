import type {
  ClaudeAccountSnapshotDto,
  ClaudeAccountUsageDto,
  ClaudeAccountValidationDto,
} from './dto';

export interface CreateClaudeAccountProfileOptions {
  /** Pre-populate the email on the Anthropic login page. */
  email?: string;
}

export interface ClaudeAccountElectronApi {
  getClaudeAccountSnapshot: () => Promise<ClaudeAccountSnapshotDto>;
  refreshClaudeAccountSnapshot: () => Promise<ClaudeAccountSnapshotDto>;
  /**
   * Allocates a new `~/.claude-profile-NN` config dir and runs `claude auth login` against
   * it (opens the browser OAuth flow). Resolves with the refreshed snapshot once login
   * completes. Rejects if login fails or times out.
   */
  createClaudeAccountProfile: (
    options?: CreateClaudeAccountProfileOptions
  ) => Promise<ClaudeAccountSnapshotDto>;
  /**
   * Probes one account's subscription usage (5h / weekly windows) by running the account's
   * runtime status with `CLAUDE_CONFIG_DIR` pinned. Lazy + cached + short timeout; resolves
   * with empty `windows` when usage is unavailable rather than rejecting. Pass `force` to
   * bypass the cache (e.g. a per-account Refresh action).
   */
  getClaudeAccountUsage: (configDir: string, force?: boolean) => Promise<ClaudeAccountUsageDto>;
  /**
   * Verifies one account's stored credentials against the API to catch accounts that look
   * connected locally but are actually revoked/closed server-side. Lazy + cached; resolves
   * with `unknown` rather than rejecting when it cannot determine a verdict. Pass `force` to
   * bypass the cache (e.g. after a reconnect or a per-account Refresh action).
   */
  getClaudeAccountValidation: (
    configDir: string,
    force?: boolean
  ) => Promise<ClaudeAccountValidationDto>;
  /**
   * Re-authenticates an existing account dir by running `claude auth login` against it (opens
   * the browser OAuth flow), then resolves with the refreshed snapshot. Use to recover an
   * account whose token was revoked/closed, or to sign back into a signed-out slot.
   */
  reconnectClaudeAccount: (configDir: string) => Promise<ClaudeAccountSnapshotDto>;
  onClaudeAccountSnapshotChanged: (
    callback: (event: unknown, snapshot: ClaudeAccountSnapshotDto) => void
  ) => () => void;
}
