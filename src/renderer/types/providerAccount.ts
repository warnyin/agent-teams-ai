import type { TeamProviderId } from '@shared/types';

export type ProviderAccountStatus = 'connected' | 'signed_out' | 'unknown';

export interface ProviderAccountUsageWindow {
  /** 0..100 */
  usedPercent: number;
  resetsAtMs: number | null;
  /** Short window label, e.g. "5h", "Weekly". */
  label: string;
}

/**
 * A single connected account for a provider. The Providers panel renders one card per
 * ProviderAccount, so a provider with N accounts shows N cards. Provider-agnostic: each
 * provider feature contributes its own accounts (see useProviderAccounts).
 */
export interface ProviderAccount {
  providerId: TeamProviderId;
  /** Stable id within the provider: config dir (anthropic) / account key (codex). */
  accountId: string;
  providerLabel: string;
  email: string | null;
  /** Uppercased plan badge (e.g. "MAX"), or null. */
  plan: string | null;
  status: ProviderAccountStatus;
  /** The account the runtime currently authenticates as. */
  isActive: boolean;
  /** Per-account usage; null until probed, undefined = not applicable. */
  usage?: ProviderAccountUsageWindow[] | null;
}
