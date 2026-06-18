// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { listClaudeAccounts } from '@features/claude-account/core/application/listAccounts';

import type {
  AccountDiscoveryPort,
  AuthStatusProbePort,
  ClaudeAccountDirInfo,
  ClockPort,
  LoggerPort,
} from '@features/claude-account/core/application/ports';
import type { ClaudeAuthStatusResult } from '@features/claude-account/core/domain/parseClaudeAuthStatus';

const DEFAULT_DIR = 'C:/Users/me/.claude';

function makeLogger(): LoggerPort {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeClock(iso = '2026-06-18T00:00:00.000Z'): ClockPort {
  return { nowIso: () => iso };
}

function discovery(dirs: ClaudeAccountDirInfo[]): AccountDiscoveryPort {
  return { discover: () => Promise.resolve(dirs) };
}

function probeFrom(map: Record<string, ClaudeAuthStatusResult | Error>): AuthStatusProbePort {
  return {
    probe: (configDir: string) => {
      const entry = map[configDir];
      if (entry instanceof Error) {
        return Promise.reject(entry);
      }
      return Promise.resolve(entry);
    },
  };
}

function loggedIn(overrides: Partial<ClaudeAuthStatusResult> = {}): ClaudeAuthStatusResult {
  return {
    loggedIn: true,
    email: 'user@example.com',
    authMethod: 'claude.ai',
    apiProvider: 'firstParty',
    subscriptionType: 'max',
    orgName: 'Org',
    orgId: 'org-1',
    ...overrides,
  };
}

describe('listClaudeAccounts', () => {
  it('builds a sorted snapshot with default first and probes login state', async () => {
    const snapshot = await listClaudeAccounts({
      discovery: discovery([
        { configDir: 'C:/Users/me/.claude-pro', hasCredentials: true },
        { configDir: DEFAULT_DIR, hasCredentials: true },
        { configDir: 'C:/Users/me/.claude-max1', hasCredentials: true },
      ]),
      probe: probeFrom({
        [DEFAULT_DIR]: loggedIn({ email: 'default@x.com' }),
        'C:/Users/me/.claude-pro': loggedIn({ email: 'pro@x.com', subscriptionType: 'pro' }),
        'C:/Users/me/.claude-max1': loggedIn({ email: 'max1@x.com' }),
      }),
      clock: makeClock(),
      logger: makeLogger(),
      defaultConfigDir: DEFAULT_DIR,
    });

    expect(snapshot.accounts.map((a) => a.label)).toEqual(['Default', 'Max1', 'Pro']);
    expect(snapshot.accounts[0]).toMatchObject({
      isDefault: true,
      email: 'default@x.com',
      loginStatus: 'logged_in',
      plan: 'max',
      authKind: 'subscription',
    });
    expect(snapshot.accounts[2]).toMatchObject({ label: 'Pro', plan: 'pro' });
    expect(snapshot.defaultConfigDir).toBe(DEFAULT_DIR);
    expect(snapshot.updatedAt).toBe('2026-06-18T00:00:00.000Z');
  });

  it('degrades a failed probe to unknown without failing the whole list', async () => {
    const logger = makeLogger();
    const snapshot = await listClaudeAccounts({
      discovery: discovery([
        { configDir: DEFAULT_DIR, hasCredentials: true },
        { configDir: 'C:/Users/me/.claude-max1', hasCredentials: false },
      ]),
      probe: probeFrom({
        [DEFAULT_DIR]: loggedIn(),
        'C:/Users/me/.claude-max1': new Error('spawn timeout'),
      }),
      clock: makeClock(),
      logger,
      defaultConfigDir: DEFAULT_DIR,
    });

    const max1 = snapshot.accounts.find((a) => a.label === 'Max1');
    expect(max1?.loginStatus).toBe('unknown');
    expect(max1?.email).toBeNull();
    expect(max1?.hasCredentials).toBe(false);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('reports logged-out accounts distinctly from unknown', async () => {
    const snapshot = await listClaudeAccounts({
      discovery: discovery([{ configDir: 'C:/Users/me/.claude-max2', hasCredentials: true }]),
      probe: probeFrom({
        'C:/Users/me/.claude-max2': {
          loggedIn: false,
          email: null,
          authMethod: null,
          apiProvider: null,
          subscriptionType: null,
          orgName: null,
          orgId: null,
        },
      }),
      clock: makeClock(),
      logger: makeLogger(),
      defaultConfigDir: DEFAULT_DIR,
    });

    expect(snapshot.accounts[0].loginStatus).toBe('logged_out');
  });
});
