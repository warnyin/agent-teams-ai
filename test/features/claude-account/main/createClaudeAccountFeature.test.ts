// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createClaudeAccountFeature } from '@features/claude-account/main/composition/createClaudeAccountFeature';

import type {
  AccountDiscoveryPort,
  AuthStatusProbePort,
  ClockPort,
  LoggerPort,
} from '@features/claude-account/core/application/ports';
import type { ClaudeAuthStatusResult } from '@features/claude-account/core/domain/parseClaudeAuthStatus';

const DEFAULT_DIR = 'C:/Users/me/.claude';

function loggedIn(): ClaudeAuthStatusResult {
  return {
    loggedIn: true,
    email: 'user@example.com',
    authMethod: 'claude.ai',
    apiProvider: 'firstParty',
    subscriptionType: 'max',
    orgName: 'Org',
    orgId: 'org-1',
  };
}

function makeDeps() {
  const discover = vi.fn().mockResolvedValue([{ configDir: DEFAULT_DIR, hasCredentials: true }]);
  const probe = vi.fn().mockResolvedValue(loggedIn());
  const discovery: AccountDiscoveryPort = { discover };
  const probePort: AuthStatusProbePort = { probe };
  const clock: ClockPort = { nowIso: () => '2026-06-18T00:00:00.000Z' };
  const logger: LoggerPort = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { discover, probe, discovery, probePort, clock, logger };
}

describe('createClaudeAccountFeature', () => {
  it('builds a snapshot and serves it from cache within the TTL', async () => {
    const { discover, discovery, probePort, clock, logger } = makeDeps();
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      clock,
      defaultConfigDir: DEFAULT_DIR,
      cacheTtlMs: 60_000,
    });

    const first = await feature.getSnapshot();
    const second = await feature.getSnapshot();

    expect(first.accounts).toHaveLength(1);
    expect(first.accounts[0].email).toBe('user@example.com');
    expect(second).toEqual(first);
    expect(discover).toHaveBeenCalledTimes(1); // cache hit on second call
  });

  it('refreshSnapshot bypasses the cache and re-discovers', async () => {
    const { discover, discovery, probePort, clock, logger } = makeDeps();
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      clock,
      defaultConfigDir: DEFAULT_DIR,
      cacheTtlMs: 60_000,
    });

    await feature.getSnapshot();
    await feature.refreshSnapshot();

    expect(discover).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent refreshes into a single discovery', async () => {
    const { discover, discovery, probePort, clock, logger } = makeDeps();
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      clock,
      defaultConfigDir: DEFAULT_DIR,
    });

    await Promise.all([feature.getSnapshot(), feature.getSnapshot()]);

    expect(discover).toHaveBeenCalledTimes(1);
  });
});
