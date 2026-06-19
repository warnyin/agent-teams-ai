// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { parseAnthropicAccountUsage } from '@features/claude-account/core/domain/parseAccountUsage';

function runtimeStatus(anthropic: Record<string, unknown>): string {
  return JSON.stringify({ schemaVersion: 1, providers: { anthropic } });
}

describe('parseAnthropicAccountUsage', () => {
  it('maps primary + secondary windows for a subscription account', () => {
    const json = runtimeStatus({
      authMethod: 'claude.ai',
      subscriptionRateLimits: {
        primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: 1_700_000_000 },
        secondary: { usedPercent: 40, windowDurationMins: 10_080, resetsAt: 1_700_600_000 },
      },
    });

    expect(parseAnthropicAccountUsage(json)).toEqual([
      { usedPercent: 12, resetsAtMs: 1_700_000_000_000, label: '5h' },
      { usedPercent: 40, resetsAtMs: 1_700_600_000_000, label: 'Weekly' },
    ]);
  });

  it('clamps usedPercent to 0..100', () => {
    const json = runtimeStatus({
      authMethod: 'oauth_token',
      subscriptionRateLimits: {
        primary: { usedPercent: 140, windowDurationMins: 300, resetsAt: null },
      },
    });

    expect(parseAnthropicAccountUsage(json)).toEqual([
      { usedPercent: 100, resetsAtMs: null, label: '5h' },
    ]);
  });

  it('passes through resetsAt already in milliseconds', () => {
    const json = runtimeStatus({
      authMethod: 'claude.ai',
      subscriptionRateLimits: {
        primary: { usedPercent: 5, windowDurationMins: 60, resetsAt: 1_700_000_000_000 },
      },
    });

    expect(parseAnthropicAccountUsage(json)).toEqual([
      { usedPercent: 5, resetsAtMs: 1_700_000_000_000, label: '1h' },
    ]);
  });

  it('returns [] for API-key (non-subscription) auth', () => {
    const json = runtimeStatus({
      authMethod: 'api_key',
      subscriptionRateLimits: {
        primary: { usedPercent: 10, windowDurationMins: 300, resetsAt: 1_700_000_000 },
      },
    });

    expect(parseAnthropicAccountUsage(json)).toEqual([]);
  });

  it('returns [] when rate limits are absent', () => {
    expect(parseAnthropicAccountUsage(runtimeStatus({ authMethod: 'claude.ai' }))).toEqual([]);
  });

  it('skips a window with a non-numeric usedPercent', () => {
    const json = runtimeStatus({
      authMethod: 'claude.ai',
      subscriptionRateLimits: {
        primary: { usedPercent: 'n/a', windowDurationMins: 300, resetsAt: 1_700_000_000 },
        secondary: { usedPercent: 22, windowDurationMins: 10_080, resetsAt: 1_700_600_000 },
      },
    });

    expect(parseAnthropicAccountUsage(json)).toEqual([
      { usedPercent: 22, resetsAtMs: 1_700_600_000_000, label: 'Weekly' },
    ]);
  });

  it('tolerates leading noise before the JSON object', () => {
    const json = `warning: using cached runtime\n${runtimeStatus({
      authMethod: 'claude.ai',
      subscriptionRateLimits: {
        primary: { usedPercent: 0, windowDurationMins: 1_440, resetsAt: 1_700_000_000 },
      },
    })}`;

    expect(parseAnthropicAccountUsage(json)).toEqual([
      { usedPercent: 0, resetsAtMs: 1_700_000_000_000, label: '1d' },
    ]);
  });

  it('returns [] for malformed output', () => {
    expect(parseAnthropicAccountUsage('not json at all')).toEqual([]);
    expect(parseAnthropicAccountUsage('')).toEqual([]);
  });
});
