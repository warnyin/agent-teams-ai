import type { ClaudeAccountOptionViewModel } from '../adapters/toAccountViewModel';
import type { JSX } from 'react';

export interface ClaudeAccountPickerProps {
  options: ClaudeAccountOptionViewModel[];
  /** Currently selected account id, or null for the default account. */
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
  label?: string;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

function optionText(option: ClaudeAccountOptionViewModel): string {
  const parts = [option.label];
  if (option.planLabel) {
    parts.push(`(${option.planLabel})`);
  }
  parts.push(`— ${option.detail}`);
  if (!option.selectable) {
    parts.push('· unavailable');
  }
  return parts.join(' ');
}

/**
 * Dumb, presentational account picker. Holds no transport or store access — the parent
 * supplies view models and handles selection.
 */
export function ClaudeAccountPicker({
  options,
  selectedAccountId,
  onSelect,
  label = 'Claude account',
  loading = false,
  error = null,
  disabled = false,
}: ClaudeAccountPickerProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <select
        className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 disabled:opacity-50"
        value={selectedAccountId ?? ''}
        disabled={disabled || loading || options.length === 0}
        onChange={(event) => onSelect(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} disabled={!option.selectable}>
            {optionText(option)}
          </option>
        ))}
      </select>
      {loading ? <span className="text-xs text-gray-500">Loading accounts…</span> : null}
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
