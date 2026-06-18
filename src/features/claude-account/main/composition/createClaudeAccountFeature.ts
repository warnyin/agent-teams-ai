import { mkdir } from 'node:fs/promises';

import { ClaudeBinaryResolver } from '@main/services/team/ClaudeBinaryResolver';
import { execCli } from '@main/utils/childProcess';
import { buildEnrichedEnv } from '@main/utils/cliEnv';
import { getAutoDetectedClaudeBasePath, getHomeDir } from '@main/utils/pathDecoder';

import { listClaudeAccounts } from '../../core/application/listAccounts';
import { ClaudeAccountSnapshotPresenter } from '../adapters/output/presenters/ClaudeAccountSnapshotPresenter';
import { ClaudeAuthStatusProbe } from '../infrastructure/ClaudeAuthStatusProbe';
import { createClaudeProfileAndLogin } from '../infrastructure/createClaudeProfile';
import { ClaudeConfigDirDiscovery } from '../infrastructure/discoverClaudeConfigDirs';

import type {
  AccountDiscoveryPort,
  AuthStatusProbePort,
  ClockPort,
  LoggerPort,
} from '../../core/application/ports';
import type {
  ClaudeAccountSnapshotDto,
  CreateClaudeAccountProfileOptions,
} from '@features/claude-account/contracts';
import type { BrowserWindow } from 'electron';

const DEFAULT_SNAPSHOT_CACHE_TTL_MS = 30_000;
const LOGIN_TIMEOUT_MS = 300_000;

export interface ClaudeAccountFeatureFacade {
  /** Returns a cached snapshot when fresh, otherwise refreshes. */
  getSnapshot(): Promise<ClaudeAccountSnapshotDto>;
  /** Forces a fresh discovery + probe and broadcasts the result. */
  refreshSnapshot(): Promise<ClaudeAccountSnapshotDto>;
  /** Creates a new `~/.claude-profile-NN` account and logs into it, then refreshes. */
  createProfile(options?: CreateClaudeAccountProfileOptions): Promise<ClaudeAccountSnapshotDto>;
  setMainWindow(window: BrowserWindow | null): void;
  dispose(): void;
}

export interface CreateClaudeAccountFeatureDeps {
  logger: LoggerPort;
  cacheTtlMs?: number;
  /** Test/override seams; real implementations are built when omitted. */
  discovery?: AccountDiscoveryPort;
  probe?: AuthStatusProbePort;
  clock?: ClockPort;
  defaultConfigDir?: string;
}

export function createClaudeAccountFeature(
  deps: CreateClaudeAccountFeatureDeps
): ClaudeAccountFeatureFacade {
  const defaultConfigDir = deps.defaultConfigDir ?? getAutoDetectedClaudeBasePath();
  const cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_SNAPSHOT_CACHE_TTL_MS;
  const clock: ClockPort = deps.clock ?? { nowIso: () => new Date().toISOString() };

  const discovery: AccountDiscoveryPort =
    deps.discovery ?? new ClaudeConfigDirDiscovery({ homeDir: getHomeDir(), defaultConfigDir });

  const probe: AuthStatusProbePort =
    deps.probe ??
    new ClaudeAuthStatusProbe({
      defaultConfigDir,
      resolveBinary: () => ClaudeBinaryResolver.resolve(),
      exec: async (binaryPath, args, options) => {
        const result = await execCli(binaryPath, args, options);
        return { stdout: result.stdout };
      },
      buildEnv: (binaryPath) => buildEnrichedEnv(binaryPath),
    });

  const presenter = new ClaudeAccountSnapshotPresenter();

  let cache: { snapshot: ClaudeAccountSnapshotDto; at: number } | null = null;
  let inFlight: Promise<ClaudeAccountSnapshotDto> | null = null;

  const refresh = (): Promise<ClaudeAccountSnapshotDto> => {
    if (inFlight) {
      return inFlight;
    }
    inFlight = listClaudeAccounts({
      discovery,
      probe,
      clock,
      logger: deps.logger,
      defaultConfigDir,
    })
      .then((snapshot) => {
        cache = { snapshot, at: Date.now() };
        presenter.publish(snapshot);
        return snapshot;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    getSnapshot(): Promise<ClaudeAccountSnapshotDto> {
      if (cache && Date.now() - cache.at < cacheTtlMs) {
        return Promise.resolve(cache.snapshot);
      }
      return refresh();
    },
    refreshSnapshot(): Promise<ClaudeAccountSnapshotDto> {
      return refresh();
    },
    async createProfile(
      options?: CreateClaudeAccountProfileOptions
    ): Promise<ClaudeAccountSnapshotDto> {
      await createClaudeProfileAndLogin({
        homeDir: getHomeDir(),
        listExistingConfigDirs: async () =>
          (await discovery.discover()).map((info) => info.configDir),
        ensureDir: async (dir) => {
          await mkdir(dir, { recursive: true });
        },
        resolveBinary: () => ClaudeBinaryResolver.resolve(),
        buildEnv: (binaryPath) => buildEnrichedEnv(binaryPath),
        runLogin: async (binaryPath, args, env) => {
          await execCli(binaryPath, args, { timeout: LOGIN_TIMEOUT_MS, env });
        },
        email: options?.email,
      });
      return refresh();
    },
    setMainWindow(window: BrowserWindow | null): void {
      presenter.setMainWindow(window);
    },
    dispose(): void {
      cache = null;
      inFlight = null;
      presenter.setMainWindow(null);
    },
  };
}
