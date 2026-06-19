import { isDefaultConfigDir } from '@features/claude-account/core/domain/accountIdentity';
import {
  type AccountUsageWindow,
  parseAnthropicAccountUsage,
} from '@features/claude-account/core/domain/parseAccountUsage';

import type { UsageProbePort } from '@features/claude-account/core/application/ports';

/**
 * Bounded timeout — usage is non-critical (the cards already render without it), but the
 * runtime cold-starts on first spawn and is slower under concurrent probes, so this is more
 * generous than a typical status call. On timeout the facade degrades to N/A.
 */
const DEFAULT_USAGE_PROBE_TIMEOUT_MS = 20_000;
const USAGE_PROBE_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

export interface CliExecResult {
  stdout: string;
}

export interface ClaudeAccountUsageProbeDeps {
  /** Auto-detected default config dir (`~/.claude`). */
  defaultConfigDir: string;
  /** Resolves the Claude CLI binary path, or null when unavailable. */
  resolveBinary: () => Promise<string | null>;
  /** Runs the CLI; injected so unit tests avoid spawning real processes. */
  exec: (
    binaryPath: string,
    args: string[],
    options: { timeout: number; maxBuffer: number; env: NodeJS.ProcessEnv }
  ) => Promise<CliExecResult>;
  /** Builds the enriched CLI env for a given binary. */
  buildEnv: (binaryPath: string) => NodeJS.ProcessEnv;
  timeoutMs?: number;
}

/**
 * Probes one account's subscription usage (5h / weekly) by running
 * `runtime status --json --provider anthropic` with `CLAUDE_CONFIG_DIR` pinned to that
 * account's dir. The default dir is probed WITHOUT setting `CLAUDE_CONFIG_DIR` (setting it to
 * `~/.claude` breaks the macOS Keychain OAuth namespace — same rule as the auth probe).
 *
 * Note: the full (non-`--summary`) status is used deliberately — `--summary` returns
 * `subscriptionRateLimits: null` for non-active accounts, so it cannot report per-account
 * usage. The full status returns the account's cached rate-limit windows when present.
 */
export class ClaudeAccountUsageProbe implements UsageProbePort {
  private readonly timeoutMs: number;

  constructor(private readonly deps: ClaudeAccountUsageProbeDeps) {
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_USAGE_PROBE_TIMEOUT_MS;
  }

  async probe(configDir: string): Promise<AccountUsageWindow[]> {
    const binaryPath = await this.deps.resolveBinary();
    if (!binaryPath) {
      throw new Error('Claude CLI binary not found');
    }

    const env = this.buildEnvForConfigDir(binaryPath, configDir);
    const { stdout } = await this.deps.exec(
      binaryPath,
      ['runtime', 'status', '--json', '--provider', 'anthropic'],
      { timeout: this.timeoutMs, maxBuffer: USAGE_PROBE_MAX_BUFFER_BYTES, env }
    );
    return parseAnthropicAccountUsage(stdout);
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
