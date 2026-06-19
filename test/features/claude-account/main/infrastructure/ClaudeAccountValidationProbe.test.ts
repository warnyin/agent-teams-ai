// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { ClaudeAccountValidationProbe } from '@features/claude-account/main/infrastructure/ClaudeAccountValidationProbe';

const NOW = 1_700_000_000_000;
const FUTURE = NOW + 60 * 60_000;

function creds(accessToken: string | null, expiresAtMs: number | null): string {
  return JSON.stringify({ claudeAiOauth: { accessToken, expiresAt: expiresAtMs } });
}

describe('ClaudeAccountValidationProbe', () => {
  it('returns invalid when the API rejects an unexpired token (401)', async () => {
    const checkAuth = vi.fn().mockResolvedValue(401);
    const probe = new ClaudeAccountValidationProbe({
      readCredentialsFile: vi.fn().mockResolvedValue(creds('tok', FUTURE)),
      checkAuth,
      now: () => NOW,
    });

    expect(await probe.probe('C:/x/.claude-max1')).toBe('invalid');
    expect(checkAuth).toHaveBeenCalledWith('tok');
  });

  it('returns valid when the token authenticates (400 = bad body, auth ok)', async () => {
    const probe = new ClaudeAccountValidationProbe({
      readCredentialsFile: vi.fn().mockResolvedValue(creds('tok', FUTURE)),
      checkAuth: vi.fn().mockResolvedValue(400),
      now: () => NOW,
    });

    expect(await probe.probe('C:/x/.claude-profile-01')).toBe('valid');
  });

  it('returns unknown WITHOUT calling the API when the token is already expired', async () => {
    const checkAuth = vi.fn().mockResolvedValue(401);
    const probe = new ClaudeAccountValidationProbe({
      readCredentialsFile: vi.fn().mockResolvedValue(creds('tok', NOW - 60_000)),
      checkAuth,
      now: () => NOW,
    });

    expect(await probe.probe('C:/x/.claude')).toBe('unknown');
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it('returns unknown when no credentials file exists', async () => {
    const checkAuth = vi.fn();
    const probe = new ClaudeAccountValidationProbe({
      readCredentialsFile: vi.fn().mockResolvedValue(null),
      checkAuth,
      now: () => NOW,
    });

    expect(await probe.probe('C:/x/.claude')).toBe('unknown');
    expect(checkAuth).not.toHaveBeenCalled();
  });

  it('returns unknown on a network error (null status)', async () => {
    const probe = new ClaudeAccountValidationProbe({
      readCredentialsFile: vi.fn().mockResolvedValue(creds('tok', FUTURE)),
      checkAuth: vi.fn().mockResolvedValue(null),
      now: () => NOW,
    });

    expect(await probe.probe('C:/x/.claude-max1')).toBe('unknown');
  });
});
