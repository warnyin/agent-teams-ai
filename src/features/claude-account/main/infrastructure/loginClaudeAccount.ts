import { isDefaultConfigDir } from '@features/claude-account/core/domain/accountIdentity';

export interface LoginClaudeAccountDeps {
  /** The existing account config dir to (re-)authenticate. */
  configDir: string;
  /** Auto-detected default config dir (`~/.claude`). */
  defaultConfigDir: string;
  resolveBinary: () => Promise<string | null>;
  buildEnv: (binaryPath: string) => NodeJS.ProcessEnv;
  /** Runs `claude auth login` (opens browser OAuth); resolves on success, rejects otherwise. */
  runLogin: (binaryPath: string, args: string[], env: NodeJS.ProcessEnv) => Promise<void>;
}

/**
 * Re-authenticates an EXISTING account dir by running `claude auth login --claudeai` with
 * `CLAUDE_CONFIG_DIR` pinned to that dir (the default dir is logged in WITHOUT setting it, to
 * preserve the macOS Keychain OAuth namespace — same rule as the auth/usage probes). Unlike
 * createClaudeProfileAndLogin this does NOT allocate a new dir; it overwrites the creds in the
 * given dir, so a card whose token was revoked/closed can sign back in (into the same slot).
 */
export async function loginClaudeAccount(deps: LoginClaudeAccountDeps): Promise<void> {
  const binaryPath = await deps.resolveBinary();
  if (!binaryPath) {
    throw new Error('Claude CLI binary not found');
  }

  const env = { ...deps.buildEnv(binaryPath) };
  if (isDefaultConfigDir(deps.configDir, deps.defaultConfigDir)) {
    delete env.CLAUDE_CONFIG_DIR;
  } else {
    env.CLAUDE_CONFIG_DIR = deps.configDir;
  }

  await deps.runLogin(binaryPath, ['auth', 'login', '--claudeai'], env);
}
