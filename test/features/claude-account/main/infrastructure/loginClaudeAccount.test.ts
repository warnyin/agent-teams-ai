// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { loginClaudeAccount } from '@features/claude-account/main/infrastructure/loginClaudeAccount';

const DEFAULT_DIR = 'C:/Users/me/.claude';

function makeDeps(overrides: Partial<Parameters<typeof loginClaudeAccount>[0]> = {}) {
  const runLogin = vi.fn().mockResolvedValue(undefined);
  return {
    runLogin,
    deps: {
      configDir: 'C:/Users/me/.claude-max1',
      defaultConfigDir: DEFAULT_DIR,
      resolveBinary: vi.fn().mockResolvedValue('C:/bin/claude.exe'),
      buildEnv: () => ({ PATH: '/x' }) as NodeJS.ProcessEnv,
      runLogin,
      ...overrides,
    },
  };
}

describe('loginClaudeAccount', () => {
  it('pins CLAUDE_CONFIG_DIR for a non-default dir and runs the claude.ai login', async () => {
    const { runLogin, deps } = makeDeps();

    await loginClaudeAccount(deps);

    expect(runLogin).toHaveBeenCalledTimes(1);
    const [binary, args, env] = runLogin.mock.calls[0];
    expect(binary).toBe('C:/bin/claude.exe');
    expect(args).toEqual(['auth', 'login', '--claudeai']);
    expect(env.CLAUDE_CONFIG_DIR).toBe('C:/Users/me/.claude-max1');
  });

  it('does NOT set CLAUDE_CONFIG_DIR for the default dir', async () => {
    const { runLogin, deps } = makeDeps({ configDir: DEFAULT_DIR });

    await loginClaudeAccount(deps);

    const [, , env] = runLogin.mock.calls[0];
    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined();
  });

  it('throws when the binary cannot be resolved', async () => {
    const { runLogin, deps } = makeDeps({ resolveBinary: vi.fn().mockResolvedValue(null) });

    await expect(loginClaudeAccount(deps)).rejects.toThrow('Claude CLI binary not found');
    expect(runLogin).not.toHaveBeenCalled();
  });
});
