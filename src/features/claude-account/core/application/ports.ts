import type { AccountConnectivity } from '../domain/accountConnectivity';
import type { AccountUsageWindow } from '../domain/parseAccountUsage';
import type { ClaudeAuthStatusResult } from '../domain/parseClaudeAuthStatus';

/** A discovered candidate config dir before its login state is probed. */
export interface ClaudeAccountDirInfo {
  configDir: string;
  hasCredentials: boolean;
}

/** Discovers candidate Claude config dirs (e.g. `~/.claude` + sibling `~/.claude-*`). */
export interface AccountDiscoveryPort {
  discover(): Promise<ClaudeAccountDirInfo[]>;
}

/** Probes a single config dir's login state via `claude auth status`. */
export interface AuthStatusProbePort {
  probe(configDir: string): Promise<ClaudeAuthStatusResult>;
}

/** Probes a single config dir's subscription usage via `runtime status --summary`. */
export interface UsageProbePort {
  probe(configDir: string): Promise<AccountUsageWindow[]>;
}

/** Verifies a single config dir's credentials against the API for live connectivity. */
export interface ValidationProbePort {
  probe(configDir: string): Promise<AccountConnectivity>;
}

export interface LoggerPort {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ClockPort {
  nowIso(): string;
}
