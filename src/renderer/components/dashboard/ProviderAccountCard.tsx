import { ProviderBrandLogo } from '@renderer/components/common/ProviderBrandLogo';
import { Loader2, LogIn, RefreshCw, SlidersHorizontal } from 'lucide-react';

import type {
  ProviderAccount,
  ProviderAccountStatus,
  ProviderAccountUsageWindow,
} from '@renderer/types/providerAccount';
import type { JSX } from 'react';

const STATUS_BADGE: Record<
  ProviderAccountStatus,
  { label: string; color: string; background: string }
> = {
  connected: { label: 'Connected', color: 'rgb(74,222,128)', background: 'rgba(34,197,94,0.14)' },
  signed_out: {
    label: 'Signed out',
    color: 'rgb(248,113,113)',
    background: 'rgba(248,113,113,0.14)',
  },
  unknown: {
    label: 'Unknown',
    color: 'var(--color-text-muted)',
    background: 'var(--color-surface-overlay)',
  },
};

const INVALID_BADGE = {
  label: 'Reconnect',
  color: 'rgb(248,113,113)',
  background: 'rgba(248,113,113,0.14)',
} as const;

function isInvalidConnectivity(account: ProviderAccount): boolean {
  return account.connectivity === 'invalid';
}

function statusLine(account: ProviderAccount): string {
  if (isInvalidConnectivity(account)) {
    return 'Account unavailable — sign in again';
  }
  switch (account.status) {
    case 'connected':
      return `Connected via ${account.providerLabel} subscription`;
    case 'signed_out':
      return 'Signed out';
    default:
      return 'Status unknown';
  }
}

const PILL_CLASS =
  'shrink-0 whitespace-nowrap rounded bg-[var(--color-surface-overlay)] px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.06em]';

function formatUsageReset(resetsAtMs: number | null): string | null {
  if (resetsAtMs === null || !Number.isFinite(resetsAtMs) || resetsAtMs <= 0) {
    return null;
  }
  return new Date(resetsAtMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const UsageChip = ({ window }: { window: ProviderAccountUsageWindow }): JSX.Element => {
  const remaining = Math.max(0, Math.min(100, 100 - window.usedPercent));
  const depleted = window.usedPercent >= 100;
  const resetText = formatUsageReset(window.resetsAtMs);

  return (
    <div
      className="w-fit max-w-full rounded-md border px-2 py-1"
      style={{
        borderColor: depleted ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)',
        backgroundColor: depleted ? 'rgba(248,113,113,0.06)' : 'rgba(74,222,128,0.06)',
      }}
    >
      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span
          className="text-[10px] uppercase tracking-[0.06em]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {window.label}
        </span>
        <span className="text-xs font-medium" style={{ color: depleted ? '#f87171' : '#86efac' }}>
          {remaining}% left
        </span>
        {resetText ? (
          <span
            className="min-w-0 truncate text-[10px]"
            style={{ color: 'var(--color-text-secondary)' }}
            title={resetText}
          >
            • resets {resetText}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export interface ProviderAccountCardProps {
  account: ProviderAccount;
  refreshing?: boolean;
  /** True while this account's reconnect (login) flow is in progress. */
  reconnecting?: boolean;
  actionsDisabled?: boolean;
  onRefresh?: () => void;
  /** Re-authenticate this account (opens browser login). */
  onReconnect?: () => void;
  /** Open the provider settings for this account's provider. */
  onManage?: () => void;
}

/** A connect button is offered whenever the account is not currently usable. */
function needsConnect(account: ProviderAccount): boolean {
  return account.connectivity === 'invalid' || account.status !== 'connected';
}

function connectLabel(account: ProviderAccount): string {
  return account.connectivity === 'invalid' ? 'Reconnect' : 'Sign in';
}

/**
 * One card per provider-account in the Providers panel (e.g. "Anthropic — email").
 * Presentational; mirrors the provider card style.
 */
export const ProviderAccountCard = ({
  account,
  refreshing = false,
  reconnecting = false,
  actionsDisabled = false,
  onRefresh,
  onReconnect,
  onManage,
}: Readonly<ProviderAccountCardProps>): JSX.Element => {
  const invalid = isInvalidConnectivity(account);
  const badge = invalid ? INVALID_BADGE : STATUS_BADGE[account.status];
  const showConnect = Boolean(onReconnect) && needsConnect(account);
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-md p-2"
      style={{ backgroundColor: 'var(--color-surface-raised)' }}
    >
      <div className="col-span-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <ProviderBrandLogo providerId={account.providerId} className="size-4 shrink-0" />
              <span
                className="truncate whitespace-nowrap text-xs font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                {account.providerLabel}
                {account.email ? ` — ${account.email}` : ''}
              </span>
              {account.plan ? <span className={PILL_CLASS}>{account.plan}</span> : null}
              {account.isActive ? <span className={PILL_CLASS}>Active</span> : null}
            </span>
            <span className="whitespace-nowrap text-xs" style={{ color: badge.color }}>
              {statusLine(account)}
            </span>
          </div>
          {!invalid && account.usage && account.usage.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {account.usage.map((usageWindow) => (
                <UsageChip key={usageWindow.label} window={usageWindow} />
              ))}
            </div>
          ) : !invalid && account.usage === null ? (
            // Probed, but the runtime reported no rate-limit data for this account
            // (distinct from `undefined`, which means the probe is still in flight).
            <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Usage unavailable
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="shrink-0 whitespace-nowrap rounded px-1.5 py-px text-[9px] font-medium uppercase tracking-[0.06em]"
            style={{ color: badge.color, backgroundColor: badge.background }}
          >
            {badge.label}
          </span>
          {showConnect && onReconnect ? (
            <button
              onClick={onReconnect}
              disabled={actionsDisabled || reconnecting}
              className="flex items-center gap-1 rounded-md border px-2 py-[3px] text-[10px] font-medium transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{
                borderColor: invalid ? 'rgba(248,113,113,0.4)' : 'var(--color-border)',
                color: invalid ? '#f87171' : 'var(--color-text-secondary)',
              }}
              title={
                reconnecting
                  ? 'Opening sign-in in your browser…'
                  : `${connectLabel(account)} ${account.providerLabel}`
              }
            >
              {reconnecting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <LogIn className="size-3" />
              )}
              {reconnecting ? 'Signing in…' : connectLabel(account)}
            </button>
          ) : null}
          {onManage ? (
            <button
              onClick={onManage}
              disabled={actionsDisabled}
              className="flex items-center gap-1 rounded-md border px-2 py-[3px] text-[10px] font-medium transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              title={`Manage ${account.providerLabel}`}
            >
              <SlidersHorizontal className="size-3" />
              Manage
            </button>
          ) : null}
          {onRefresh ? (
            <button
              onClick={onRefresh}
              disabled={actionsDisabled || refreshing}
              className="flex items-center gap-1 rounded-md border px-1.5 py-[3px] text-[10px] transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              title={`Re-check ${account.providerLabel}`}
            >
              <RefreshCw className={refreshing ? 'size-[11px] animate-spin' : 'size-[11px]'} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
