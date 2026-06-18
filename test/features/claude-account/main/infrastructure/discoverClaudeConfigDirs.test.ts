// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ClaudeConfigDirDiscovery } from '@features/claude-account/main/infrastructure/discoverClaudeConfigDirs';

let homeDir: string;

async function makeDir(name: string, withCredentials: boolean): Promise<string> {
  const dir = path.join(homeDir, name);
  await mkdir(dir, { recursive: true });
  if (withCredentials) {
    await writeFile(path.join(dir, '.credentials.json'), '{}', 'utf8');
  }
  return dir;
}

beforeEach(async () => {
  homeDir = await mkdtemp(path.join(os.tmpdir(), 'claude-acct-disc-'));
});

afterEach(async () => {
  await rm(homeDir, { recursive: true, force: true });
});

describe('ClaudeConfigDirDiscovery', () => {
  it('discovers default + sibling .claude-* dirs that have credentials', async () => {
    await makeDir('.claude', true);
    await makeDir('.claude-max1', true);
    await makeDir('.claude-pro', true);

    const discovery = new ClaudeConfigDirDiscovery({
      homeDir,
      defaultConfigDir: path.join(homeDir, '.claude'),
    });

    const infos = await discovery.discover();
    const names = infos.map((i) => path.basename(i.configDir)).sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(['.claude', '.claude-max1', '.claude-pro']);
    expect(infos.every((i) => i.hasCredentials)).toBe(true);
  });

  it('excludes .claude-* dirs without a credentials file', async () => {
    await makeDir('.claude', true);
    await makeDir('.claude-code-session', false);
    await makeDir('.claude-work', false);

    const discovery = new ClaudeConfigDirDiscovery({
      homeDir,
      defaultConfigDir: path.join(homeDir, '.claude'),
    });

    const names = (await discovery.discover()).map((i) => path.basename(i.configDir));
    expect(names).toContain('.claude');
    expect(names).not.toContain('.claude-code-session');
    expect(names).not.toContain('.claude-work');
  });

  it('always includes the default dir even when it has no credentials yet', async () => {
    await mkdir(path.join(homeDir, '.claude'), { recursive: true });

    const discovery = new ClaudeConfigDirDiscovery({
      homeDir,
      defaultConfigDir: path.join(homeDir, '.claude'),
    });

    const infos = await discovery.discover();
    expect(infos).toHaveLength(1);
    expect(infos[0]).toMatchObject({ hasCredentials: false });
    expect(path.basename(infos[0].configDir)).toBe('.claude');
  });

  it('merges explicit extra config dirs and dedupes', async () => {
    await makeDir('.claude', true);
    const extra = await makeDir('.claude-extra', true);

    const discovery = new ClaudeConfigDirDiscovery({
      homeDir,
      defaultConfigDir: path.join(homeDir, '.claude'),
      extraConfigDirs: [extra, extra],
    });

    const names = (await discovery.discover())
      .map((i) => path.basename(i.configDir))
      .sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(['.claude', '.claude-extra']);
  });

  it('returns the default dir gracefully when home dir is unreadable', async () => {
    const discovery = new ClaudeConfigDirDiscovery({
      homeDir: path.join(homeDir, 'does-not-exist'),
      defaultConfigDir: path.join(homeDir, 'does-not-exist', '.claude'),
    });

    const infos = await discovery.discover();
    expect(infos).toHaveLength(1);
    expect(path.basename(infos[0].configDir)).toBe('.claude');
  });
});
