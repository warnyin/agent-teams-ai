// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { claudeAccountsToProviderAccounts } from '@features/claude-account/renderer/toProviderAccounts';

import type { ClaudeAccountDto } from '@features/claude-account/contracts';
import type { ProviderAccountUsageWindow } from '@renderer/types/providerAccount';

function account(overrides: Partial<ClaudeAccountDto> = {}): ClaudeAccountDto {
  return {
    id: overrides.configDir ?? 'C:/x/.claude',
    label: 'Acct',
    configDir: 'C:/x/.claude',
    isDefault: false,
    loginStatus: 'logged_in',
    email: 'dev3@ofm.co.th',
    plan: 'max',
    authKind: 'subscription',
    orgName: null,
    hasCredentials: true,
    ...overrides,
  };
}

const WINDOWS: ProviderAccountUsageWindow[] = [
  { usedPercent: 35, resetsAtMs: 1_700_000_000_000, label: '5h' },
];

describe('claudeAccountsToProviderAccounts', () => {
  it('maps core fields and uppercases the plan', () => {
    const [mapped] = claudeAccountsToProviderAccounts([
      account({ configDir: 'C:/x/.claude-max1', isDefault: true }),
    ]);
    expect(mapped).toMatchObject({
      providerId: 'anthropic',
      accountId: 'C:/x/.claude-max1',
      providerLabel: 'Anthropic',
      email: 'dev3@ofm.co.th',
      plan: 'MAX',
      status: 'connected',
      isActive: true,
    });
  });

  it('downgrades a connected account to signed_out when connectivity is invalid', () => {
    const [mapped] = claudeAccountsToProviderAccounts([account({ configDir: 'C:/x/.claude-max1' })], {
      connectivityByConfigDir: new Map([['C:/x/.claude-max1', 'invalid']]),
    });
    expect(mapped.status).toBe('signed_out');
    expect(mapped.connectivity).toBe('invalid');
  });

  it('shares usage windows across two config dirs of the same email', () => {
    const result = claudeAccountsToProviderAccounts(
      [
        account({ configDir: 'C:/x/.claude', isDefault: true }), // active, no cached usage
        account({ configDir: 'C:/x/.claude-pro' }), // sibling with usage
      ],
      {
        usageByConfigDir: new Map<string, ProviderAccountUsageWindow[] | null>([
          ['C:/x/.claude', null],
          ['C:/x/.claude-pro', WINDOWS],
        ]),
      }
    );
    expect(result[0].usage).toEqual(WINDOWS); // backfilled from the sibling
    expect(result[1].usage).toEqual(WINDOWS);
  });

  it('does not share usage across different emails', () => {
    const result = claudeAccountsToProviderAccounts(
      [
        account({ configDir: 'C:/x/.claude', email: 'a@x.com' }),
        account({ configDir: 'C:/x/.claude-pro', email: 'b@x.com' }),
      ],
      {
        usageByConfigDir: new Map<string, ProviderAccountUsageWindow[] | null>([
          ['C:/x/.claude', null],
          ['C:/x/.claude-pro', WINDOWS],
        ]),
      }
    );
    expect(result[0].usage).toBeNull();
    expect(result[1].usage).toEqual(WINDOWS);
  });

  it('leaves usage null when no same-email card has data', () => {
    const [mapped] = claudeAccountsToProviderAccounts([account({ configDir: 'C:/x/.claude' })], {
      usageByConfigDir: new Map<string, ProviderAccountUsageWindow[] | null>([
        ['C:/x/.claude', null],
      ]),
    });
    expect(mapped.usage).toBeNull();
  });
});
