// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { resolveTeamClaudeConfigDir } from '@main/services/team/teamClaudeConfigDir';

const DEFAULT_DIR = 'C:/Users/me/.claude';

describe('resolveTeamClaudeConfigDir', () => {
  it('uses a team binding and sets the env for a custom account dir', () => {
    const result = resolveTeamClaudeConfigDir({
      binding: 'C:/Users/me/.claude-profile-01',
      globalConfigDir: DEFAULT_DIR,
      defaultConfigDir: DEFAULT_DIR,
    });
    expect(result).toEqual({
      configDir: 'C:/Users/me/.claude-profile-01',
      shouldSetConfigDirEnv: true,
    });
  });

  it('falls back to the global config dir when there is no binding', () => {
    const result = resolveTeamClaudeConfigDir({
      binding: null,
      globalConfigDir: 'C:/Users/me/.claude-custom-global',
      defaultConfigDir: DEFAULT_DIR,
    });
    expect(result.configDir).toBe('C:/Users/me/.claude-custom-global');
    expect(result.shouldSetConfigDirEnv).toBe(true);
  });

  it('does NOT set the env when the resolved dir is the default (issue #27)', () => {
    const result = resolveTeamClaudeConfigDir({
      binding: undefined,
      globalConfigDir: DEFAULT_DIR,
      defaultConfigDir: DEFAULT_DIR,
    });
    expect(result.configDir).toBe(DEFAULT_DIR);
    expect(result.shouldSetConfigDirEnv).toBe(false);
  });

  it('treats a binding that points at the default dir as default (no env, separator-insensitive)', () => {
    const result = resolveTeamClaudeConfigDir({
      binding: 'C:\\Users\\me\\.claude\\',
      globalConfigDir: DEFAULT_DIR,
      defaultConfigDir: DEFAULT_DIR,
    });
    expect(result.shouldSetConfigDirEnv).toBe(false);
  });

  it('treats a blank binding as no binding', () => {
    const result = resolveTeamClaudeConfigDir({
      binding: '   ',
      globalConfigDir: DEFAULT_DIR,
      defaultConfigDir: DEFAULT_DIR,
    });
    expect(result.configDir).toBe(DEFAULT_DIR);
    expect(result.shouldSetConfigDirEnv).toBe(false);
  });
});
