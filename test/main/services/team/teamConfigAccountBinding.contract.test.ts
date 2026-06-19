// @vitest-environment node
import { homedir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { TeamConfig } from '@shared/types/team';

/**
 * Cross-repo contract test for per-member Claude account binding.
 *
 * The desktop app (TeamProvisioningService.writeOpenCodeTeamConfig) writes each member's
 * `accountBindingByProvider` into `~/.claude/teams/<team>/config.json` verbatim. The
 * orchestrator runtime (warnyin/claude-multimodel) reads it back and decides each teammate's
 * CLAUDE_CONFIG_DIR:
 *
 *   runtime: resolveMemberClaudeConfigDirBinding() → member.accountBindingByProvider?.anthropic
 *   runtime: resolveBoundTeammateConfigDir(override) → trimmed non-empty non-default ? dir : null
 *            (the default `~/.claude` must NEVER be pinned — agent-teams-ai issue #27)
 *
 * This test pins that contract from the app side: it serializes a TeamConfig exactly as the
 * writer does (JSON.stringify(config, null, 2)), then reads + resolves it the way the runtime
 * does. If the field name/nesting/semantics drift on either side, this breaks.
 *
 * Mirror of the runtime's resolveMemberClaudeConfigDirBinding read step.
 * Returns: string (bound dir) | null (explicit default account) | undefined (inherit team).
 */
function runtimeReadMemberBinding(
  serializedConfig: string,
  memberName: string
): string | null | undefined {
  const parsed = JSON.parse(serializedConfig) as TeamConfig;
  const member = parsed.members?.find((m) => m.name === memberName);
  return member ? member.accountBindingByProvider?.anthropic : undefined;
}

/**
 * Mirror of the runtime's resolveBoundTeammateConfigDir: the CLAUDE_CONFIG_DIR value the
 * teammate will actually be spawned with, or null to omit (inherit team / default account).
 */
function runtimeResolveConfigDirEnv(override: string | null | undefined): string | null {
  const trimmed = override?.trim();
  if (trimmed && trimmed.length > 0 && !isDefaultClaudeConfigDir(trimmed)) {
    return trimmed;
  }
  return null;
}

function isDefaultClaudeConfigDir(dir: string): boolean {
  const normalize = (value: string): string =>
    value
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/')
      .replace(/\/+$/, '');
  return normalize(dir) === normalize(join(homedir(), '.claude'));
}

const MAX1_DIR = join(homedir(), '.claude-max1');
const MAX2_DIR = join(homedir(), '.claude-max2');
const DEFAULT_DIR = join(homedir(), '.claude');

/** Serializes the same way TeamProvisioningService.writeOpenCodeTeamConfig does. */
function serialize(config: TeamConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function teamConfigWithMembers(): TeamConfig {
  return {
    name: 'Squad',
    accountBindingByProvider: { anthropic: MAX1_DIR },
    members: [
      { name: 'alice', role: 'Dev', accountBindingByProvider: { anthropic: MAX1_DIR } },
      { name: 'tom', role: 'Dev', accountBindingByProvider: { anthropic: MAX2_DIR } },
      // explicit default account (must omit CLAUDE_CONFIG_DIR — issue #27)
      { name: 'dana', role: 'Dev', accountBindingByProvider: { anthropic: null } },
      // no binding → inherit the team account
      { name: 'erin', role: 'Dev' },
      // bound on a different provider only → anthropic read is undefined (inherit)
      { name: 'frank', role: 'Dev', accountBindingByProvider: { codex: 'acct-key' } },
    ],
  };
}

describe('per-member account binding config contract (app ↔ runtime)', () => {
  it('round-trips each member binding through the runtime read step', () => {
    const serialized = serialize(teamConfigWithMembers());

    expect(runtimeReadMemberBinding(serialized, 'alice')).toBe(MAX1_DIR);
    expect(runtimeReadMemberBinding(serialized, 'tom')).toBe(MAX2_DIR);
    expect(runtimeReadMemberBinding(serialized, 'dana')).toBeNull();
    expect(runtimeReadMemberBinding(serialized, 'erin')).toBeUndefined();
    expect(runtimeReadMemberBinding(serialized, 'frank')).toBeUndefined();
  });

  it('resolves the spawned CLAUDE_CONFIG_DIR the runtime way (incl. issue #27)', () => {
    const serialized = serialize(teamConfigWithMembers());
    const envFor = (name: string): string | null =>
      runtimeResolveConfigDirEnv(runtimeReadMemberBinding(serialized, name));

    // distinct accounts per teammate — the whole point of per-member binding
    expect(envFor('alice')).toBe(MAX1_DIR);
    expect(envFor('tom')).toBe(MAX2_DIR);
    // explicit default + inherit + other-provider all omit CLAUDE_CONFIG_DIR
    expect(envFor('dana')).toBeNull();
    expect(envFor('erin')).toBeNull();
    expect(envFor('frank')).toBeNull();
  });

  it('never pins the default ~/.claude even if a member is explicitly bound to it (issue #27)', () => {
    const serialized = serialize({
      name: 'Squad',
      members: [{ name: 'alice', role: 'Dev', accountBindingByProvider: { anthropic: DEFAULT_DIR } }],
    });

    expect(runtimeReadMemberBinding(serialized, 'alice')).toBe(DEFAULT_DIR);
    expect(runtimeResolveConfigDirEnv(runtimeReadMemberBinding(serialized, 'alice'))).toBeNull();
  });

  it('preserves bindings exactly across JSON serialization (no field rename/drop)', () => {
    const serialized = serialize(teamConfigWithMembers());
    const parsed = JSON.parse(serialized) as TeamConfig;
    const alice = parsed.members?.find((m) => m.name === 'alice');

    expect(alice?.accountBindingByProvider).toEqual({ anthropic: MAX1_DIR });
  });
});
