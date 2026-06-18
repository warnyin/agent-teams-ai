// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { ClaudeAuthStatusProbe } from '@features/claude-account/main/infrastructure/ClaudeAuthStatusProbe';

const DEFAULT_DIR = 'C:/Users/me/.claude';

const LOGGED_IN_JSON = JSON.stringify({
  loggedIn: true,
  authMethod: 'claude.ai',
  apiProvider: 'firstParty',
  email: 'max1@x.com',
  subscriptionType: 'max',
});

function makeProbe(execImpl: ReturnType<typeof vi.fn>, binary: string | null = '/bin/claude') {
  return new ClaudeAuthStatusProbe({
    defaultConfigDir: DEFAULT_DIR,
    resolveBinary: () => Promise.resolve(binary),
    exec: execImpl,
    buildEnv: () => ({ BASE: '1' }),
  });
}

describe('ClaudeAuthStatusProbe', () => {
  it('sets CLAUDE_CONFIG_DIR for a custom account dir and parses the result', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: LOGGED_IN_JSON });
    const probe = makeProbe(exec);

    const result = await probe.probe('C:/Users/me/.claude-max1');

    expect(result.loggedIn).toBe(true);
    expect(result.email).toBe('max1@x.com');
    const [, args, options] = exec.mock.calls[0];
    expect(args).toEqual(['auth', 'status']);
    expect(options.env.CLAUDE_CONFIG_DIR).toBe('C:/Users/me/.claude-max1');
    expect(options.env.BASE).toBe('1');
  });

  it('does NOT set CLAUDE_CONFIG_DIR for the default dir (issue #27)', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: LOGGED_IN_JSON });
    const probe = makeProbe(exec);

    await probe.probe(DEFAULT_DIR);

    const [, , options] = exec.mock.calls[0];
    expect('CLAUDE_CONFIG_DIR' in options.env).toBe(false);
  });

  it('strips an inherited CLAUDE_CONFIG_DIR when probing the default dir', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: LOGGED_IN_JSON });
    const probe = new ClaudeAuthStatusProbe({
      defaultConfigDir: DEFAULT_DIR,
      resolveBinary: () => Promise.resolve('/bin/claude'),
      exec,
      buildEnv: () => ({ CLAUDE_CONFIG_DIR: '/some/inherited/dir' }),
    });

    await probe.probe(DEFAULT_DIR);

    const [, , options] = exec.mock.calls[0];
    expect('CLAUDE_CONFIG_DIR' in options.env).toBe(false);
  });

  it('throws when the CLI binary cannot be resolved', async () => {
    const exec = vi.fn();
    const probe = makeProbe(exec, null);

    await expect(probe.probe('C:/Users/me/.claude-max1')).rejects.toThrow(/binary not found/i);
    expect(exec).not.toHaveBeenCalled();
  });
});
