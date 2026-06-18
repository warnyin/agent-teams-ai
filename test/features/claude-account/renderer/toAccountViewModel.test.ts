// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { toAccountOptionViewModel } from '@features/claude-account/renderer/adapters/toAccountViewModel';

import type { ClaudeAccountDto } from '@features/claude-account/contracts';

function account(overrides: Partial<ClaudeAccountDto> = {}): ClaudeAccountDto {
  return {
    id: 'C:/Users/me/.claude-max1',
    label: 'Max1',
    configDir: 'C:/Users/me/.claude-max1',
    isDefault: false,
    loginStatus: 'logged_in',
    email: 'max1@x.com',
    plan: 'max',
    authKind: 'subscription',
    orgName: 'Org',
    hasCredentials: true,
    ...overrides,
  };
}

describe('toAccountOptionViewModel', () => {
  it('maps a logged-in account to a selectable option with email and plan badge', () => {
    expect(toAccountOptionViewModel(account())).toEqual({
      id: 'C:/Users/me/.claude-max1',
      configDir: 'C:/Users/me/.claude-max1',
      label: 'Max1',
      detail: 'max1@x.com',
      planLabel: 'MAX',
      status: 'logged_in',
      isDefault: false,
      selectable: true,
    });
  });

  it('shows a fallback detail and is not selectable when logged out', () => {
    const vm = toAccountOptionViewModel(
      account({ loginStatus: 'logged_out', email: null, plan: 'unknown' })
    );
    expect(vm.detail).toBe('Not signed in');
    expect(vm.planLabel).toBeNull();
    expect(vm.selectable).toBe(false);
  });

  it('shows an unknown-status fallback when probing failed', () => {
    const vm = toAccountOptionViewModel(account({ loginStatus: 'unknown', email: null }));
    expect(vm.detail).toBe('Status unknown');
    expect(vm.selectable).toBe(false);
  });
});
