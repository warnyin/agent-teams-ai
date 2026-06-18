import { isDefaultConfigDir } from '@features/claude-account/core/domain/accountIdentity';
import {
  type ClaudeAuthStatusResult,
  parseClaudeAuthStatus,
} from '@features/claude-account/core/domain/parseClaudeAuthStatus';

import type { AuthStatusProbePort } from '@features/claude-account/core/application/ports';

const DEFAULT_PROBE_TIMEOUT_MS = 30_000;

export interface CliExecResult {
  stdout: string;
}

export interface ClaudeAuthStatusProbeDeps {
  /** Auto-detected default config dir (`~/.claude`). */
  defaultConfigDir: string;
  /** Resolves the Claude CLI binary path, or null when unavailable. */
  resolveBinary: () => Promise<string | null>;
  /** Runs the CLI; injected so unit tests avoid spawning real processes. */
  exec: (
    binaryPath: string,
    args: string[],
    options: { timeout: number; env: NodeJS.ProcessEnv }
  ) => Promise<CliExecResult>;
  /** Builds the enriched CLI env for a given binary. */
  buildEnv: (binaryPath: string) => NodeJS.ProcessEnv;
  timeoutMs?: number;
}

/**
 * Probes a single config dir's login state by running `claude auth status` with
 * `CLAUDE_CONFIG_DIR` pinned to that dir. The default dir is probed WITHOUT setting
 * `CLAUDE_CONFIG_DIR` (setting it to `~/.claude` breaks the macOS Keychain OAuth
 * namespace — see issue #27).
 */
export class ClaudeAuthStatusProbe implements AuthStatusProbePort {
  private readonly timeoutMs: number;

  constructor(private readonly deps: ClaudeAuthStatusProbeDeps) {
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  }

  async probe(configDir: string): Promise<ClaudeAuthStatusResult> {
    const binaryPath = await this.deps.resolveBinary();
    if (!binaryPath) {
      throw new Error('Claude CLI binary not found');
    }

    const env = this.buildEnvForConfigDir(binaryPath, configDir);
    const { stdout } = await this.deps.exec(binaryPath, ['auth', 'status'], {
      timeout: this.timeoutMs,
      env,
    });
    return parseClaudeAuthStatus(stdout);
  }

  private buildEnvForConfigDir(binaryPath: string, configDir: string): NodeJS.ProcessEnv {
    const env = { ...this.deps.buildEnv(binaryPath) };
    if (isDefaultConfigDir(configDir, this.deps.defaultConfigDir)) {
      delete env.CLAUDE_CONFIG_DIR;
    } else {
      env.CLAUDE_CONFIG_DIR = configDir;
    }
    return env;
  }
}
