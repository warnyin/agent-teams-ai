import { join } from 'node:path';

import {
  formatProfileDirName,
  nextProfileNumber,
} from '@features/claude-account/core/domain/accountIdentity';

export interface CreateClaudeProfileDeps {
  homeDir: string;
  /** Existing config dirs, used to allocate the next `.claude-profile-NN`. */
  listExistingConfigDirs: () => Promise<string[]>;
  /** Creates the profile directory (recursive, idempotent). */
  ensureDir: (dir: string) => Promise<void>;
  resolveBinary: () => Promise<string | null>;
  buildEnv: (binaryPath: string) => NodeJS.ProcessEnv;
  /** Runs `claude auth login` (opens browser OAuth); resolves on success, rejects otherwise. */
  runLogin: (binaryPath: string, args: string[], env: NodeJS.ProcessEnv) => Promise<void>;
  email?: string;
}

export interface CreateClaudeProfileResult {
  configDir: string;
}

/**
 * Allocates a fresh app-managed profile dir (`~/.claude-profile-NN`) and runs
 * `claude auth login --claudeai` against it with `CLAUDE_CONFIG_DIR` pinned to that dir,
 * so the new account's credentials land in the new dir without touching other accounts.
 */
export async function createClaudeProfileAndLogin(
  deps: CreateClaudeProfileDeps
): Promise<CreateClaudeProfileResult> {
  const binaryPath = await deps.resolveBinary();
  if (!binaryPath) {
    throw new Error('Claude CLI binary not found');
  }

  const existing = await deps.listExistingConfigDirs();
  const configDir = join(deps.homeDir, formatProfileDirName(nextProfileNumber(existing)));
  await deps.ensureDir(configDir);

  const env = { ...deps.buildEnv(binaryPath), CLAUDE_CONFIG_DIR: configDir };
  const args = ['auth', 'login', '--claudeai'];
  if (deps.email && deps.email.trim().length > 0) {
    args.push('--email', deps.email.trim());
  }

  await deps.runLogin(binaryPath, args, env);
  return { configDir };
}
