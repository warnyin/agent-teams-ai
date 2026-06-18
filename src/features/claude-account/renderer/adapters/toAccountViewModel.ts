import type {
  ClaudeAccountDto,
  ClaudeAccountLoginStatus,
} from '@features/claude-account/contracts';

export interface ClaudeAccountOptionViewModel {
  id: string;
  configDir: string;
  label: string;
  /** Email when known, otherwise a human-readable status fallback. */
  detail: string;
  /** Uppercased plan badge (e.g. "MAX"), or null when unknown. */
  planLabel: string | null;
  status: ClaudeAccountLoginStatus;
  isDefault: boolean;
  /** Only logged-in accounts can be bound to a team. */
  selectable: boolean;
}

function detailFor(account: ClaudeAccountDto): string {
  if (account.email) {
    return account.email;
  }
  if (account.loginStatus === 'logged_out') {
    return 'Not signed in';
  }
  return 'Status unknown';
}

export function toAccountOptionViewModel(account: ClaudeAccountDto): ClaudeAccountOptionViewModel {
  return {
    id: account.id,
    configDir: account.configDir,
    label: account.label,
    detail: detailFor(account),
    planLabel: account.plan === 'unknown' ? null : account.plan.toUpperCase(),
    status: account.loginStatus,
    isDefault: account.isDefault,
    selectable: account.loginStatus === 'logged_in',
  };
}

export function toAccountOptionViewModels(
  accounts: readonly ClaudeAccountDto[]
): ClaudeAccountOptionViewModel[] {
  return accounts.map(toAccountOptionViewModel);
}
