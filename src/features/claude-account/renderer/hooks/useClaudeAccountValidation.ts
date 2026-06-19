import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, isElectronMode } from '@renderer/api';

import type { ClaudeAccountDto } from '@features/claude-account/contracts';
import type { ProviderAccountConnectivity } from '@renderer/types/providerAccount';

/** configDir → connectivity verdict (absent = check pending). */
export type ClaudeAccountConnectivityByConfigDir = ReadonlyMap<string, ProviderAccountConnectivity>;

export interface UseClaudeAccountValidationResult {
  connectivityByConfigDir: ClaudeAccountConnectivityByConfigDir;
  loading: boolean;
  /** Force re-checks one account's connectivity (bypassing the cache) and merges the verdict. */
  refresh: (configDir: string) => Promise<void>;
}

function getConnectedConfigDirs(accounts: readonly ClaudeAccountDto[]): string[] {
  return accounts
    .filter((account) => account.loginStatus === 'logged_in')
    .map((account) => account.configDir)
    .sort();
}

/**
 * Lazily verifies each locally-connected Claude account against the server so a card that
 * looks connected (valid cached token) but is actually revoked/closed gets flagged. Only
 * `logged_in` accounts are checked; the verdict is main-process cached so re-runs are cheap.
 */
export function useClaudeAccountValidation(
  accounts: readonly ClaudeAccountDto[],
  options?: { enabled?: boolean }
): UseClaudeAccountValidationResult {
  const enabled = options?.enabled ?? true;
  const active = enabled && isElectronMode();

  const [connectivityByConfigDir, setConnectivityByConfigDir] = useState<
    Map<string, ProviderAccountConnectivity>
  >(() => new Map());
  const [loading, setLoading] = useState(false);
  const latestRequestRef = useRef(0);

  const connectedConfigDirs = getConnectedConfigDirs(accounts);
  const connectedKey = connectedConfigDirs.join(' ');

  useEffect(() => {
    if (!active || connectedConfigDirs.length === 0) {
      setConnectivityByConfigDir((current) => (current.size === 0 ? current : new Map()));
      setLoading(false);
      return;
    }

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setLoading(true);

    void Promise.allSettled(
      connectedConfigDirs.map(async (configDir) => {
        const validation = await api.getClaudeAccountValidation(configDir);
        return { configDir, result: validation.result };
      })
    ).then((results) => {
      if (latestRequestRef.current !== requestId) {
        return;
      }
      const next = new Map<string, ProviderAccountConnectivity>();
      results.forEach((result, index) => {
        const configDir = connectedConfigDirs[index];
        next.set(configDir, result.status === 'fulfilled' ? result.value.result : 'unknown');
      });
      setConnectivityByConfigDir(next);
      setLoading(false);
    });
    // connectedKey captures the set of connected dirs; re-check only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, connectedKey]);

  const refresh = useCallback(
    async (configDir: string): Promise<void> => {
      if (!active) {
        return;
      }
      try {
        const validation = await api.getClaudeAccountValidation(configDir, true);
        setConnectivityByConfigDir((current) => new Map(current).set(configDir, validation.result));
      } catch {
        setConnectivityByConfigDir((current) => new Map(current).set(configDir, 'unknown'));
      }
    },
    [active]
  );

  return useMemo(
    () => ({ connectivityByConfigDir, loading, refresh }),
    [connectivityByConfigDir, loading, refresh]
  );
}
