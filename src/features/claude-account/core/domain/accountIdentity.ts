/**
 * Pure helpers for identifying Claude accounts by their config directory.
 * An account == a `CLAUDE_CONFIG_DIR`, so the normalized dir path is its stable identity.
 */

/**
 * Naming prefix for app-managed account profiles. App-created profiles use a running
 * number (`.claude-profile-01`, `.claude-profile-02`, ...) so the order is visible and
 * the app can allocate the next slot deterministically. User-made dirs (e.g.
 * `.claude-pro`) are still detected but are not app-managed.
 */
export const PROFILE_DIR_PREFIX = '.claude-profile-';

function basenameOf(configDir: string): string {
  const normalized = normalizeConfigDir(configDir);
  return normalized.split('/').filter(Boolean).pop() ?? normalized;
}

/** Normalize a config dir into a stable comparison key (separators unified, no trailing slash). */
export function normalizeConfigDir(dir: string): string {
  const unified = (dir ?? '').trim().replace(/\\/g, '/');
  const collapsed = unified.replace(/\/{2,}/g, '/');
  let end = collapsed.length;
  while (end > 1 && collapsed[end - 1] === '/') {
    end -= 1;
  }
  return collapsed.slice(0, end);
}

export function deriveAccountId(configDir: string): string {
  return normalizeConfigDir(configDir);
}

export function isDefaultConfigDir(configDir: string, defaultConfigDir: string): boolean {
  return normalizeConfigDir(configDir) === normalizeConfigDir(defaultConfigDir);
}

/**
 * Human-readable label from the dir basename.
 * `.claude` -> "Default", `.claude-max1` -> "Max1", `.claude-pro` -> "Pro".
 */
export function deriveAccountLabel(configDir: string): string {
  const base = basenameOf(configDir);

  if (base === '.claude' || base === 'claude') {
    return 'Default';
  }

  if (base.startsWith(PROFILE_DIR_PREFIX)) {
    const ordinal = base.slice(PROFILE_DIR_PREFIX.length);
    return ordinal.length > 0 ? `Profile ${ordinal}` : 'Profile';
  }

  const suffix = base.startsWith('.claude-')
    ? base.slice('.claude-'.length)
    : base.startsWith('.')
      ? base.slice(1)
      : base;

  if (suffix.length === 0) {
    return base;
  }
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

/** True when the dir is an app-managed profile (`.claude-profile-*`). */
export function isManagedProfileDir(configDir: string): boolean {
  return basenameOf(configDir).startsWith(PROFILE_DIR_PREFIX);
}

/** Formats an app-managed profile dir name from a running number (`1` -> `.claude-profile-01`). */
export function formatProfileDirName(ordinal: number): string {
  return `${PROFILE_DIR_PREFIX}${String(ordinal).padStart(2, '0')}`;
}

/**
 * Computes the next running profile number given existing config dirs, so app-created
 * profiles increment predictably (gaps from deleted profiles are not reused).
 */
export function nextProfileNumber(existingConfigDirs: readonly string[]): number {
  let max = 0;
  for (const dir of existingConfigDirs) {
    const base = basenameOf(dir);
    if (!base.startsWith(PROFILE_DIR_PREFIX)) {
      continue;
    }
    const ordinal = Number.parseInt(base.slice(PROFILE_DIR_PREFIX.length), 10);
    if (Number.isInteger(ordinal) && ordinal > max) {
      max = ordinal;
    }
  }
  return max + 1;
}

/**
 * The value to bind/override for an account. The default account MUST bind to null
 * so `CLAUDE_CONFIG_DIR` is never set to `~/.claude` (would break the macOS Keychain
 * OAuth namespace — see issue #27).
 */
export function resolveBindingForConfigDir(
  configDir: string,
  defaultConfigDir: string
): string | null {
  return isDefaultConfigDir(configDir, defaultConfigDir) ? null : configDir;
}
