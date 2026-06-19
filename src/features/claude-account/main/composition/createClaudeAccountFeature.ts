import { mkdir } from 'node:fs/promises';

import { ClaudeBinaryResolver } from '@main/services/team/ClaudeBinaryResolver';
import { execCli } from '@main/utils/childProcess';
import { buildEnrichedEnv } from '@main/utils/cliEnv';
import { getAutoDetectedClaudeBasePath, getHomeDir } from '@main/utils/pathDecoder';

import { listClaudeAccounts } from '../../core/application/listAccounts';
import { ClaudeAccountSnapshotPresenter } from '../adapters/output/presenters/ClaudeAccountSnapshotPresenter';
import { ClaudeAccountUsageProbe } from '../infrastructure/ClaudeAccountUsageProbe';
import { ClaudeAccountValidationProbe } from '../infrastructure/ClaudeAccountValidationProbe';
import { ClaudeAuthStatusProbe } from '../infrastructure/ClaudeAuthStatusProbe';
import { createClaudeProfileAndLogin } from '../infrastructure/createClaudeProfile';
import { ClaudeConfigDirDiscovery } from '../infrastructure/discoverClaudeConfigDirs';
import { loginClaudeAccount } from '../infrastructure/loginClaudeAccount';

import type {
  AccountDiscoveryPort,
  AuthStatusProbePort,
  ClockPort,
  LoggerPort,
  UsageProbePort,
  ValidationProbePort,
} from '../../core/application/ports';
import type {
  ClaudeAccountSnapshotDto,
  ClaudeAccountUsageDto,
  ClaudeAccountValidationDto,
  CreateClaudeAccountProfileOptions,
} from '@features/claude-account/contracts';
import type { BrowserWindow } from 'electron';

const DEFAULT_SNAPSHOT_CACHE_TTL_MS = 30_000;
const DEFAULT_USAGE_CACHE_TTL_MS = 30_000;
/** Account closure is rare; cache validation longer than usage to avoid repeat API calls. */
const DEFAULT_VALIDATION_CACHE_TTL_MS = 5 * 60_000;
const LOGIN_TIMEOUT_MS = 300_000;

export interface ClaudeAccountFeatureFacade {
  /** Returns a cached snapshot when fresh, otherwise refreshes. */
  getSnapshot(): Promise<ClaudeAccountSnapshotDto>;
  /** Forces a fresh discovery + probe and broadcasts the result. */
  refreshSnapshot(): Promise<ClaudeAccountSnapshotDto>;
  /** Creates a new `~/.claude-profile-NN` account and logs into it, then refreshes. */
  createProfile(options?: CreateClaudeAccountProfileOptions): Promise<ClaudeAccountSnapshotDto>;
  /** Probes one account's subscription usage (lazy + cached); never rejects. `force` re-probes. */
  getAccountUsage(configDir: string, force?: boolean): Promise<ClaudeAccountUsageDto>;
  /** Verifies one account's credentials against the API (lazy + cached); never rejects. `force` re-probes. */
  getAccountValidation(configDir: string, force?: boolean): Promise<ClaudeAccountValidationDto>;
  /** Re-authenticates an existing account dir (opens browser login), then refreshes. */
  reconnectAccount(configDir: string): Promise<ClaudeAccountSnapshotDto>;
  setMainWindow(window: BrowserWindow | null): void;
  dispose(): void;
}

export interface CreateClaudeAccountFeatureDeps {
  logger: LoggerPort;
  cacheTtlMs?: number;
  usageCacheTtlMs?: number;
  validationCacheTtlMs?: number;
  /** Test/override seams; real implementations are built when omitted. */
  discovery?: AccountDiscoveryPort;
  probe?: AuthStatusProbePort;
  usageProbe?: UsageProbePort;
  validationProbe?: ValidationProbePort;
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

  const usageProbe: UsageProbePort =
    deps.usageProbe ??
    new ClaudeAccountUsageProbe({
      defaultConfigDir,
      resolveBinary: () => ClaudeBinaryResolver.resolve(),
      exec: async (binaryPath, args, options) => {
        const result = await execCli(binaryPath, args, options);
        return { stdout: result.stdout };
      },
      buildEnv: (binaryPath) => buildEnrichedEnv(binaryPath),
    });

  const validationProbe: ValidationProbePort =
    deps.validationProbe ?? new ClaudeAccountValidationProbe();

  const presenter = new ClaudeAccountSnapshotPresenter();
  const usageCacheTtlMs = deps.usageCacheTtlMs ?? DEFAULT_USAGE_CACHE_TTL_MS;
  const validationCacheTtlMs = deps.validationCacheTtlMs ?? DEFAULT_VALIDATION_CACHE_TTL_MS;

  let cache: { snapshot: ClaudeAccountSnapshotDto; at: number } | null = null;
  let inFlight: Promise<ClaudeAccountSnapshotDto> | null = null;
  const usageCache = new Map<string, { usage: ClaudeAccountUsageDto; at: number }>();
  const usageInFlight = new Map<string, Promise<ClaudeAccountUsageDto>>();
  const validationCache = new Map<string, { validation: ClaudeAccountValidationDto; at: number }>();
  const validationInFlight = new Map<string, Promise<ClaudeAccountValidationDto>>();

  const probeUsage = (configDir: string): Promise<ClaudeAccountUsageDto> => {
    const existing = usageInFlight.get(configDir);
    if (existing) {
      return existing;
    }
    const request = usageProbe
      .probe(configDir)
      .then((windows) => ({ configDir, windows }))
      .catch((error: unknown) => {
        deps.logger.warn('Claude account usage probe failed', {
          configDir,
          error: error instanceof Error ? error.message : String(error),
        });
        return { configDir, windows: [] };
      })
      .then((usage) => {
        usageCache.set(configDir, { usage, at: Date.now() });
        return usage;
      })
      .finally(() => {
        usageInFlight.delete(configDir);
      });
    usageInFlight.set(configDir, request);
    return request;
  };

  const probeValidation = (configDir: string): Promise<ClaudeAccountValidationDto> => {
    const existing = validationInFlight.get(configDir);
    if (existing) {
      return existing;
    }
    const request = validationProbe
      .probe(configDir)
      .then((result) => ({ configDir, result }))
      .catch((error: unknown) => {
        deps.logger.warn('Claude account validation probe failed', {
          configDir,
          error: error instanceof Error ? error.message : String(error),
        });
        return { configDir, result: 'unknown' as const };
      })
      .then((validation) => {
        validationCache.set(configDir, { validation, at: Date.now() });
        return validation;
      })
      .finally(() => {
        validationInFlight.delete(configDir);
      });
    validationInFlight.set(configDir, request);
    return request;
  };

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
    getAccountUsage(configDir: string, force = false): Promise<ClaudeAccountUsageDto> {
      if (!force) {
        const cached = usageCache.get(configDir);
        if (cached && Date.now() - cached.at < usageCacheTtlMs) {
          return Promise.resolve(cached.usage);
        }
      }
      return probeUsage(configDir);
    },
    getAccountValidation(configDir: string, force = false): Promise<ClaudeAccountValidationDto> {
      if (!force) {
        const cached = validationCache.get(configDir);
        if (cached && Date.now() - cached.at < validationCacheTtlMs) {
          return Promise.resolve(cached.validation);
        }
      }
      return probeValidation(configDir);
    },
    async reconnectAccount(configDir: string): Promise<ClaudeAccountSnapshotDto> {
      await loginClaudeAccount({
        configDir,
        defaultConfigDir,
        resolveBinary: () => ClaudeBinaryResolver.resolve(),
        buildEnv: (binaryPath) => buildEnrichedEnv(binaryPath),
        runLogin: async (binaryPath, args, env) => {
          await execCli(binaryPath, args, { timeout: LOGIN_TIMEOUT_MS, env });
        },
      });
      // Stale usage/validation for this dir no longer apply after a fresh login.
      usageCache.delete(configDir);
      validationCache.delete(configDir);
      return refresh();
    },
    setMainWindow(window: BrowserWindow | null): void {
      presenter.setMainWindow(window);
    },
    dispose(): void {
      cache = null;
      inFlight = null;
      usageCache.clear();
      usageInFlight.clear();
      validationCache.clear();
      validationInFlight.clear();
      presenter.setMainWindow(null);
    },
  };
}
