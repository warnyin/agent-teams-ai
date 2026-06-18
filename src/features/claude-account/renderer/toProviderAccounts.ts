import type { ClaudeAccountDto } from '@features/claude-account/contracts';
import type { ProviderAccount, ProviderAccountStatus } from '@renderer/types/providerAccount';

function toStatus(account: ClaudeAccountDto): ProviderAccountStatus {
  switch (account.loginStatus) {
    case 'logged_in':
      return 'connected';
    case 'logged_out':
      return 'signed_out';
    default:
      return 'unknown';
  }
}

/** Maps detected Claude accounts to the provider-agnostic ProviderAccount model (anthropic). */
export function claudeAccountsToProviderAccounts(
  accounts: readonly ClaudeAccountDto[]
): ProviderAccount[] {
  return accounts.map((account) => ({
    providerId: 'anthropic',
    accountId: account.configDir,
    providerLabel: 'Anthropic',
    email: account.email,
    plan: account.plan === 'unknown' ? null : account.plan.toUpperCase(),
    status: toStatus(account),
    isActive: account.isDefault,
    usage: undefined,
  }));
}
