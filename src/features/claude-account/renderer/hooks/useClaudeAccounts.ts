import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, isElectronMode } from '@renderer/api';

import type {
  ClaudeAccountDto,
  ClaudeAccountSnapshotDto,
} from '@features/claude-account/contracts';

export interface UseClaudeAccountsResult {
  accounts: ClaudeAccountDto[];
  defaultConfigDir: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the list of Claude accounts (one per CLAUDE_CONFIG_DIR) and keeps it in sync
 * with main-process snapshot broadcasts. Transport goes through `@renderer/api` only.
 */
export function useClaudeAccounts(options?: { enabled?: boolean }): UseClaudeAccountsResult {
  const enabled = options?.enabled ?? true;
  const electronMode = isElectronMode();
  const active = enabled && electronMode;

  const [snapshot, setSnapshot] = useState<ClaudeAccountSnapshotDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await api.refreshClaudeAccountSnapshot();
      setSnapshot(next);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Failed to refresh Claude accounts'
      );
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void api
      .getClaudeAccountSnapshot()
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : 'Failed to load Claude accounts'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    const unsubscribe = api.onClaudeAccountSnapshotChanged((_event, next) => {
      if (!cancelled) {
        setSnapshot(next);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [active]);

  return useMemo(
    () => ({
      accounts: snapshot?.accounts ?? [],
      defaultConfigDir: snapshot?.defaultConfigDir ?? null,
      loading,
      error,
      refresh,
    }),
    [snapshot, loading, error, refresh]
  );
}
