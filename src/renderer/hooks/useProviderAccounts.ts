import { useCallback, useMemo } from 'react';

import {
  claudeAccountsToProviderAccounts,
  useClaudeAccounts,
  useClaudeAccountUsage,
  useClaudeAccountValidation,
} from '@features/claude-account/renderer';

import type { CreateClaudeAccountProfileOptions } from '@features/claude-account/contracts';
import type { ProviderAccount } from '@renderer/types/providerAccount';
import type { TeamProviderId } from '@shared/types';

export interface UseProviderAccountsResult {
  /** Accounts grouped by provider. A provider absent here has no multi-account source. */
  accountsByProvider: Partial<Record<TeamProviderId, ProviderAccount[]>>;
  loading: boolean;
  /** Adds a new account for a provider (currently only anthropic). Opens the login flow. */
  createAccount: (
    providerId: TeamProviderId,
    options?: CreateClaudeAccountProfileOptions
  ) => Promise<void>;
  /** Re-authenticates an existing account (currently only anthropic). Opens the login flow. */
  reconnectAccount: (providerId: TeamProviderId, accountId: string) => Promise<void>;
  /** Force re-probes one account's snapshot, usage, and connectivity (per-account Refresh). */
  refreshAccount: (providerId: TeamProviderId, accountId: string) => Promise<void>;
}

/**
 * Aggregates provider-account lists across provider features (anthropic via claude-account
 * today; codex via codex-account at P4). The Providers panel renders one card per account.
 */
export function useProviderAccounts(options?: { enabled?: boolean }): UseProviderAccountsResult {
  const enabled = options?.enabled ?? true;
  const {
    accounts: claudeAccounts,
    loading,
    createProfile,
    reconnect,
    refresh: refreshClaudeSnapshot,
  } = useClaudeAccounts({ enabled });
  const { usageByConfigDir, refresh: refreshUsage } = useClaudeAccountUsage(claudeAccounts, {
    enabled,
  });
  const { connectivityByConfigDir, refresh: refreshValidation } = useClaudeAccountValidation(
    claudeAccounts,
    { enabled }
  );

  const createAccount = useCallback(
    async (providerId: TeamProviderId, createOptions?: CreateClaudeAccountProfileOptions) => {
      if (providerId === 'anthropic') {
        await createProfile(createOptions);
        return;
      }
      throw new Error(`Adding accounts is not supported for ${providerId} yet`);
    },
    [createProfile]
  );

  const reconnectAccount = useCallback(
    async (providerId: TeamProviderId, accountId: string) => {
      if (providerId !== 'anthropic') {
        throw new Error(`Reconnecting accounts is not supported for ${providerId} yet`);
      }
      await reconnect(accountId);
      // A fresh login can flip the verdict (revoked → valid) without changing the set of
      // connected dirs, so the validation/usage effects would not re-run on their own —
      // force a re-probe so the badge and usage stop showing the stale pre-reconnect state.
      await Promise.all([refreshValidation(accountId), refreshUsage(accountId)]);
    },
    [reconnect, refreshValidation, refreshUsage]
  );

  const refreshAccount = useCallback(
    async (providerId: TeamProviderId, accountId: string) => {
      if (providerId !== 'anthropic') {
        throw new Error(`Refreshing accounts is not supported for ${providerId} yet`);
      }
      // accountId is the config dir for anthropic; re-probe everything scoped to it.
      await Promise.all([
        refreshClaudeSnapshot(),
        refreshUsage(accountId),
        refreshValidation(accountId),
      ]);
    },
    [refreshClaudeSnapshot, refreshUsage, refreshValidation]
  );

  const accountsByProvider = useMemo<Partial<Record<TeamProviderId, ProviderAccount[]>>>(() => {
    const grouped: Partial<Record<TeamProviderId, ProviderAccount[]>> = {};
    const anthropic = claudeAccountsToProviderAccounts(claudeAccounts, {
      usageByConfigDir,
      connectivityByConfigDir,
    });
    if (anthropic.length > 0) {
      grouped.anthropic = anthropic;
    }
    return grouped;
  }, [claudeAccounts, usageByConfigDir, connectivityByConfigDir]);

  return useMemo(
    () => ({ accountsByProvider, loading, createAccount, reconnectAccount, refreshAccount }),
    [accountsByProvider, loading, createAccount, reconnectAccount, refreshAccount]
  );
}
