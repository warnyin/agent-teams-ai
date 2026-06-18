import {
  isDefaultConfigDir,
  normalizeConfigDir,
} from '@features/claude-account/core/domain/accountIdentity';
import { type Dirent, promises as fs } from 'fs';
import path from 'path';

import type {
  AccountDiscoveryPort,
  ClaudeAccountDirInfo,
} from '@features/claude-account/core/application/ports';

const CREDENTIALS_FILE = '.credentials.json';

export interface ClaudeConfigDirDiscoveryOptions {
  /** Home directory to scan for `.claude` and `.claude-*` config dirs. */
  homeDir: string;
  /** Auto-detected default config dir (`~/.claude`). */
  defaultConfigDir: string;
  /** Additional config dirs the user registered explicitly. */
  extraConfigDirs?: string[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isClaudeConfigDirName(name: string): boolean {
  return name === '.claude' || name.startsWith('.claude-');
}

/**
 * Discovers Claude account config dirs by scanning the home directory for `~/.claude`
 * and sibling `~/.claude-*` directories that hold a `.credentials.json`. The default
 * dir is always included; unrelated dirs (e.g. `.claude-code-session`) are excluded
 * because they have no credentials file.
 */
export class ClaudeConfigDirDiscovery implements AccountDiscoveryPort {
  constructor(private readonly options: ClaudeConfigDirDiscoveryOptions) {}

  async discover(): Promise<ClaudeAccountDirInfo[]> {
    const candidates = await this.collectCandidatePaths();

    const infos = await Promise.all(
      candidates.map(async (configDir): Promise<ClaudeAccountDirInfo> => {
        const hasCredentials = await fileExists(path.join(configDir, CREDENTIALS_FILE));
        return { configDir, hasCredentials };
      })
    );

    return infos.filter(
      (info) =>
        info.hasCredentials || isDefaultConfigDir(info.configDir, this.options.defaultConfigDir)
    );
  }

  private async collectCandidatePaths(): Promise<string[]> {
    const seen = new Set<string>();
    const ordered: string[] = [];

    const add = (configDir: string): void => {
      const key = normalizeConfigDir(configDir);
      if (key.length === 0 || seen.has(key)) {
        return;
      }
      seen.add(key);
      ordered.push(configDir);
    };

    add(this.options.defaultConfigDir);

    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(this.options.homeDir, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (entry.isDirectory() && isClaudeConfigDirName(entry.name)) {
        add(path.join(this.options.homeDir, entry.name));
      }
    }

    for (const extra of this.options.extraConfigDirs ?? []) {
      add(extra);
    }

    return ordered;
  }
}
