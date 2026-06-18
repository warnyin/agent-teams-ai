import type { ClaudeAccountSnapshotDto } from './dto';

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
  onClaudeAccountSnapshotChanged: (
    callback: (event: unknown, snapshot: ClaudeAccountSnapshotDto) => void
  ) => () => void;
}
