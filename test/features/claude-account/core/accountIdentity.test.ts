// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  deriveAccountId,
  deriveAccountLabel,
  formatProfileDirName,
  isDefaultConfigDir,
  isManagedProfileDir,
  nextProfileNumber,
  normalizeConfigDir,
  resolveBindingForConfigDir,
} from '@features/claude-account/core/domain/accountIdentity';

describe('normalizeConfigDir', () => {
  it('unifies separators, collapses duplicates, and strips trailing slash', () => {
    expect(normalizeConfigDir('C:\\Users\\me\\.claude-max1\\')).toBe('C:/Users/me/.claude-max1');
    expect(normalizeConfigDir('/home/me//.claude/')).toBe('/home/me/.claude');
    expect(normalizeConfigDir('  /home/me/.claude  ')).toBe('/home/me/.claude');
  });
});

describe('deriveAccountLabel', () => {
  it('labels the default dir as Default', () => {
    expect(deriveAccountLabel('C:/Users/me/.claude')).toBe('Default');
  });

  it('derives a capitalized label from the suffix for user-made dirs', () => {
    expect(deriveAccountLabel('C:/Users/me/.claude-max1')).toBe('Max1');
    expect(deriveAccountLabel('/home/me/.claude-pro')).toBe('Pro');
    expect(deriveAccountLabel('/home/me/.claude-work')).toBe('Work');
  });

  it('labels app-managed profiles with their running number', () => {
    expect(deriveAccountLabel('C:/Users/me/.claude-profile-01')).toBe('Profile 01');
    expect(deriveAccountLabel('/home/me/.claude-profile-12')).toBe('Profile 12');
  });
});

describe('isManagedProfileDir', () => {
  it('detects app-managed profile dirs only', () => {
    expect(isManagedProfileDir('C:/Users/me/.claude-profile-01')).toBe(true);
    expect(isManagedProfileDir('C:/Users/me/.claude-max1')).toBe(false);
    expect(isManagedProfileDir('C:/Users/me/.claude')).toBe(false);
  });
});

describe('formatProfileDirName', () => {
  it('zero-pads the running number to two digits', () => {
    expect(formatProfileDirName(1)).toBe('.claude-profile-01');
    expect(formatProfileDirName(12)).toBe('.claude-profile-12');
    expect(formatProfileDirName(100)).toBe('.claude-profile-100');
  });
});

describe('nextProfileNumber', () => {
  it('starts at 1 when no managed profiles exist', () => {
    expect(nextProfileNumber(['C:/Users/me/.claude', 'C:/Users/me/.claude-pro'])).toBe(1);
  });

  it('returns one past the highest existing profile number (no gap reuse)', () => {
    expect(
      nextProfileNumber([
        'C:/Users/me/.claude-profile-01',
        'C:/Users/me/.claude-profile-03',
        'C:/Users/me/.claude-pro',
      ])
    ).toBe(4);
  });
});

describe('isDefaultConfigDir', () => {
  it('matches regardless of separator style and trailing slash', () => {
    expect(isDefaultConfigDir('C:\\Users\\me\\.claude', 'C:/Users/me/.claude/')).toBe(true);
    expect(isDefaultConfigDir('C:/Users/me/.claude-max1', 'C:/Users/me/.claude')).toBe(false);
  });
});

describe('deriveAccountId', () => {
  it('uses the normalized dir as the stable id', () => {
    expect(deriveAccountId('C:\\Users\\me\\.claude-max1\\')).toBe('C:/Users/me/.claude-max1');
  });
});

describe('resolveBindingForConfigDir', () => {
  it('binds the default account to null (issue #27 keychain safety)', () => {
    expect(resolveBindingForConfigDir('C:/Users/me/.claude', 'C:/Users/me/.claude')).toBeNull();
  });

  it('binds a custom account to its config dir', () => {
    expect(resolveBindingForConfigDir('C:/Users/me/.claude-max1', 'C:/Users/me/.claude')).toBe(
      'C:/Users/me/.claude-max1'
    );
  });
});
