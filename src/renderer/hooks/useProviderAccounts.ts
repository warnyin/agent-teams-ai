import { useCallback, useMemo } from 'react';

import {
  claudeAccountsToProviderAccounts,
  useClaudeAccounts,
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
}

/**
 * Aggregates provider-account lists across provider features (anthropic via claude-account
 * today; codex via codex-account at P4). The Providers panel renders one card per account.
 */
export function useProviderAccounts(options?: { enabled?: boolean }): UseProviderAccountsResult {
  const enabled = options?.enabled ?? true;
  const { accounts: claudeAccounts, loading, createProfile } = useClaudeAccounts({ enabled });

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

  const accountsByProvider = useMemo<Partial<Record<TeamProviderId, ProviderAccount[]>>>(() => {
    const grouped: Partial<Record<TeamProviderId, ProviderAccount[]>> = {};
    const anthropic = claudeAccountsToProviderAccounts(claudeAccounts);
    if (anthropic.length > 0) {
      grouped.anthropic = anthropic;
    }
    return grouped;
  }, [claudeAccounts]);

  return useMemo(
    () => ({ accountsByProvider, loading, createAccount }),
    [accountsByProvider, loading, createAccount]
  );
}
