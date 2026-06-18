import { useMemo } from 'react';

import {
  claudeAccountsToProviderAccounts,
  useClaudeAccounts,
} from '@features/claude-account/renderer';

import type { ProviderAccount } from '@renderer/types/providerAccount';
import type { TeamProviderId } from '@shared/types';

export interface UseProviderAccountsResult {
  /** Accounts grouped by provider. A provider absent here has no multi-account source. */
  accountsByProvider: Partial<Record<TeamProviderId, ProviderAccount[]>>;
  loading: boolean;
}

/**
 * Aggregates provider-account lists across provider features (anthropic via claude-account
 * today; codex via codex-account at P4). The Providers panel renders one card per account.
 */
export function useProviderAccounts(options?: { enabled?: boolean }): UseProviderAccountsResult {
  const enabled = options?.enabled ?? true;
  const { accounts: claudeAccounts, loading } = useClaudeAccounts({ enabled });

  return useMemo(() => {
    const accountsByProvider: Partial<Record<TeamProviderId, ProviderAccount[]>> = {};
    const anthropic = claudeAccountsToProviderAccounts(claudeAccounts);
    if (anthropic.length > 0) {
      accountsByProvider.anthropic = anthropic;
    }
    return { accountsByProvider, loading };
  }, [claudeAccounts, loading]);
}
