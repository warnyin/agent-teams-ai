import type { ClaudeAccountDto } from '@features/claude-account/contracts';
import type {
  ProviderAccount,
  ProviderAccountConnectivity,
  ProviderAccountStatus,
  ProviderAccountUsageWindow,
} from '@renderer/types/providerAccount';

export interface ClaudeProviderAccountExtras {
  /** Per-account usage windows keyed by config dir (array, null = none, absent = pending). */
  usageByConfigDir?: ReadonlyMap<string, ProviderAccountUsageWindow[] | null>;
  /** Per-account live connectivity verdict keyed by config dir (absent = pending). */
  connectivityByConfigDir?: ReadonlyMap<string, ProviderAccountConnectivity>;
}

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

function emailKey(email: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}

/**
 * Usage windows reflect the *subscription's* 5h/weekly quota, so two config dirs signed into
 * the same account share one quota. The runtime caches those numbers per config dir, so one
 * dir can report them while another (e.g. the default `~/.claude`) reports none. Share the
 * best available windows across same-email cards so they stay consistent instead of one card
 * showing usage and its twin showing "unavailable". Connectivity stays per dir (each dir holds
 * its own token, which can be revoked independently).
 */
function shareUsageAcrossSameEmail(accounts: ProviderAccount[]): ProviderAccount[] {
  const usageByEmail = new Map<string, ProviderAccountUsageWindow[]>();
  for (const account of accounts) {
    const key = emailKey(account.email);
    if (key && account.usage && account.usage.length > 0 && !usageByEmail.has(key)) {
      usageByEmail.set(key, account.usage);
    }
  }
  if (usageByEmail.size === 0) {
    return accounts;
  }
  return accounts.map((account) => {
    if (account.usage && account.usage.length > 0) {
      return account;
    }
    const key = emailKey(account.email);
    const shared = key ? usageByEmail.get(key) : undefined;
    return shared ? { ...account, usage: shared } : account;
  });
}

/**
 * Maps detected Claude accounts to the provider-agnostic ProviderAccount model (anthropic).
 * `extras.usageByConfigDir` attaches per-account usage windows (array / null / pending), and
 * `extras.connectivityByConfigDir` layers the live server verdict on top — an `invalid`
 * verdict downgrades a locally-"connected" account to `signed_out` so the count and badge
 * stop claiming it is connected. Usage is then shared across same-email cards (see
 * `shareUsageAcrossSameEmail`).
 */
export function claudeAccountsToProviderAccounts(
  accounts: readonly ClaudeAccountDto[],
  extras: ClaudeProviderAccountExtras = {}
): ProviderAccount[] {
  const mapped = accounts.map((account): ProviderAccount => {
    const connectivity = extras.connectivityByConfigDir?.get(account.configDir);
    const baseStatus = toStatus(account);
    const status: ProviderAccountStatus =
      connectivity === 'invalid' && baseStatus === 'connected' ? 'signed_out' : baseStatus;
    return {
      providerId: 'anthropic',
      accountId: account.configDir,
      providerLabel: 'Anthropic',
      email: account.email,
      plan: account.plan === 'unknown' ? null : account.plan.toUpperCase(),
      status,
      isActive: account.isDefault,
      usage: extras.usageByConfigDir?.get(account.configDir),
      connectivity,
    };
  });
  return shareUsageAcrossSameEmail(mapped);
}
