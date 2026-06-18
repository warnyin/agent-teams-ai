import { deriveAccountId, deriveAccountLabel, isDefaultConfigDir } from '../domain/accountIdentity';
import {
  type ClaudeAuthStatusResult,
  mapClaudeAuthKind,
  mapClaudePlan,
} from '../domain/parseClaudeAuthStatus';

import type {
  AccountDiscoveryPort,
  AuthStatusProbePort,
  ClaudeAccountDirInfo,
  ClockPort,
  LoggerPort,
} from './ports';
import type {
  ClaudeAccountDto,
  ClaudeAccountLoginStatus,
  ClaudeAccountSnapshotDto,
} from '@features/claude-account/contracts';

export interface ListClaudeAccountsDeps {
  discovery: AccountDiscoveryPort;
  probe: AuthStatusProbePort;
  clock: ClockPort;
  logger: LoggerPort;
  /** The auto-detected default config dir (`~/.claude`). */
  defaultConfigDir: string;
}

function toLoginStatus(status: ClaudeAuthStatusResult | null): ClaudeAccountLoginStatus {
  if (!status) {
    return 'unknown';
  }
  return status.loggedIn ? 'logged_in' : 'logged_out';
}

function toAccountDto(
  info: ClaudeAccountDirInfo,
  status: ClaudeAuthStatusResult | null,
  defaultConfigDir: string
): ClaudeAccountDto {
  return {
    id: deriveAccountId(info.configDir),
    label: deriveAccountLabel(info.configDir),
    configDir: info.configDir,
    isDefault: isDefaultConfigDir(info.configDir, defaultConfigDir),
    loginStatus: toLoginStatus(status),
    email: status?.email ?? null,
    plan: mapClaudePlan(status?.subscriptionType ?? null),
    authKind: mapClaudeAuthKind(status?.apiProvider ?? null, status?.authMethod ?? null),
    orgName: status?.orgName ?? null,
    hasCredentials: info.hasCredentials,
  };
}

function sortAccounts(accounts: ClaudeAccountDto[]): ClaudeAccountDto[] {
  return [...accounts].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
}

/**
 * Discovers all Claude config dirs and probes each for login state, producing a snapshot.
 * Probe failures degrade a single account to `unknown` rather than failing the whole list.
 */
export async function listClaudeAccounts(
  deps: ListClaudeAccountsDeps
): Promise<ClaudeAccountSnapshotDto> {
  const dirs = await deps.discovery.discover();

  const accounts = await Promise.all(
    dirs.map(async (info): Promise<ClaudeAccountDto> => {
      let status: ClaudeAuthStatusResult | null = null;
      try {
        status = await deps.probe.probe(info.configDir);
      } catch (error) {
        deps.logger.warn('claude-account probe failed', {
          configDir: info.configDir,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return toAccountDto(info, status, deps.defaultConfigDir);
    })
  );

  return {
    accounts: sortAccounts(accounts),
    defaultConfigDir: deps.defaultConfigDir,
    updatedAt: deps.clock.nowIso(),
  };
}
