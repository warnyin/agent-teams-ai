import type { TeamProviderId } from '@shared/types';

export type ProviderAccountStatus = 'connected' | 'signed_out' | 'unknown';

/**
 * Live server-side connectivity verdict, layered on top of the local `status`:
 * - `invalid` — credentials look present locally but the server rejected them (revoked/closed).
 * - `valid`   — credentials verified against the server.
 * - `unknown` — not determinable; the card defers to `status`.
 * `undefined` means the check has not run yet.
 */
export type ProviderAccountConnectivity = 'valid' | 'invalid' | 'unknown';

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
  /** Live server-side connectivity verdict; undefined until the check runs. */
  connectivity?: ProviderAccountConnectivity;
}
