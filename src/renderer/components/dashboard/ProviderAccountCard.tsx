import { ProviderBrandLogo } from '@renderer/components/common/ProviderBrandLogo';
import { RefreshCw } from 'lucide-react';

import type { ProviderAccount, ProviderAccountStatus } from '@renderer/types/providerAccount';
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

function statusLine(account: ProviderAccount): string {
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

export interface ProviderAccountCardProps {
  account: ProviderAccount;
  refreshing?: boolean;
  actionsDisabled?: boolean;
  onRefresh?: () => void;
}

/**
 * One card per provider-account in the Providers panel (e.g. "Anthropic — email").
 * Presentational; mirrors the provider card style.
 */
export const ProviderAccountCard = ({
  account,
  refreshing = false,
  actionsDisabled = false,
  onRefresh,
}: Readonly<ProviderAccountCardProps>): JSX.Element => {
  const badge = STATUS_BADGE[account.status];
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
          {account.usage && account.usage.length > 0 ? (
            <div
              className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {account.usage.map((usageWindow) => (
                <span key={usageWindow.label}>
                  {usageWindow.label} {Math.round(usageWindow.usedPercent)}%
                </span>
              ))}
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
