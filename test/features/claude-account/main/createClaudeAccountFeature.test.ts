// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createClaudeAccountFeature } from '@features/claude-account/main/composition/createClaudeAccountFeature';

import type {
  AccountDiscoveryPort,
  AuthStatusProbePort,
  ClockPort,
  LoggerPort,
  UsageProbePort,
  ValidationProbePort,
} from '@features/claude-account/core/application/ports';
import type { AccountUsageWindow } from '@features/claude-account/core/domain/parseAccountUsage';
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

  it('serves account usage from cache within the TTL and dedupes concurrent probes', async () => {
    const { discovery, probePort, clock, logger } = makeDeps();
    const windows: AccountUsageWindow[] = [{ usedPercent: 12, resetsAtMs: null, label: '5h' }];
    const usageSpy = vi.fn().mockResolvedValue(windows);
    const usageProbe: UsageProbePort = { probe: usageSpy };
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      usageProbe,
      clock,
      defaultConfigDir: DEFAULT_DIR,
      usageCacheTtlMs: 60_000,
    });

    const [first, second] = await Promise.all([
      feature.getAccountUsage('C:/Users/me/.claude-profile-01'),
      feature.getAccountUsage('C:/Users/me/.claude-profile-01'),
    ]);
    const third = await feature.getAccountUsage('C:/Users/me/.claude-profile-01');

    expect(first).toEqual({ configDir: 'C:/Users/me/.claude-profile-01', windows });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(usageSpy).toHaveBeenCalledTimes(1); // dedup + cache hit
  });

  it('re-probes account usage when force bypasses the cache', async () => {
    const { discovery, probePort, clock, logger } = makeDeps();
    const windows: AccountUsageWindow[] = [{ usedPercent: 12, resetsAtMs: null, label: '5h' }];
    const usageSpy = vi.fn().mockResolvedValue(windows);
    const usageProbe: UsageProbePort = { probe: usageSpy };
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      usageProbe,
      clock,
      defaultConfigDir: DEFAULT_DIR,
      usageCacheTtlMs: 60_000,
    });

    await feature.getAccountUsage('C:/Users/me/.claude-profile-01');
    await feature.getAccountUsage('C:/Users/me/.claude-profile-01'); // cache hit
    await feature.getAccountUsage('C:/Users/me/.claude-profile-01', true); // force re-probe

    expect(usageSpy).toHaveBeenCalledTimes(2);
  });

  it('re-probes account validation when force bypasses the cache', async () => {
    const { discovery, probePort, clock, logger } = makeDeps();
    const validationSpy = vi.fn().mockResolvedValue('valid');
    const validationProbe: ValidationProbePort = { probe: validationSpy };
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      validationProbe,
      clock,
      defaultConfigDir: DEFAULT_DIR,
      validationCacheTtlMs: 60_000,
    });

    await feature.getAccountValidation('C:/Users/me/.claude-max1');
    await feature.getAccountValidation('C:/Users/me/.claude-max1'); // cache hit
    await feature.getAccountValidation('C:/Users/me/.claude-max1', true); // force re-probe

    expect(validationSpy).toHaveBeenCalledTimes(2);
  });

  it('returns empty usage windows when the probe fails (graceful N/A)', async () => {
    const { discovery, probePort, clock, logger } = makeDeps();
    const usageProbe: UsageProbePort = {
      probe: vi.fn().mockRejectedValue(new Error('timed out')),
    };
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      usageProbe,
      clock,
      defaultConfigDir: DEFAULT_DIR,
    });

    const usage = await feature.getAccountUsage('C:/Users/me/.claude-profile-02');

    expect(usage).toEqual({ configDir: 'C:/Users/me/.claude-profile-02', windows: [] });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('serves account validation from cache within the TTL and dedupes concurrent probes', async () => {
    const { discovery, probePort, clock, logger } = makeDeps();
    const validationSpy = vi.fn().mockResolvedValue('invalid');
    const validationProbe: ValidationProbePort = { probe: validationSpy };
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      validationProbe,
      clock,
      defaultConfigDir: DEFAULT_DIR,
      validationCacheTtlMs: 60_000,
    });

    const [first, second] = await Promise.all([
      feature.getAccountValidation('C:/Users/me/.claude-max1'),
      feature.getAccountValidation('C:/Users/me/.claude-max1'),
    ]);
    const third = await feature.getAccountValidation('C:/Users/me/.claude-max1');

    expect(first).toEqual({ configDir: 'C:/Users/me/.claude-max1', result: 'invalid' });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(validationSpy).toHaveBeenCalledTimes(1);
  });

  it('returns unknown validation when the probe throws (graceful)', async () => {
    const { discovery, probePort, clock, logger } = makeDeps();
    const validationProbe: ValidationProbePort = {
      probe: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const feature = createClaudeAccountFeature({
      logger,
      discovery,
      probe: probePort,
      validationProbe,
      clock,
      defaultConfigDir: DEFAULT_DIR,
    });

    const validation = await feature.getAccountValidation('C:/Users/me/.claude-max2');

    expect(validation).toEqual({ configDir: 'C:/Users/me/.claude-max2', result: 'unknown' });
    expect(logger.warn).toHaveBeenCalled();
  });
});
