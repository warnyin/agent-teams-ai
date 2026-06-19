/**
 * Pure parser for per-account subscription usage, derived from the runtime status JSON
 * produced by `runtime status --json --provider anthropic --summary`.
 *
 * Mirrors the active-account mapping in `ClaudeMultimodelBridgeService`
 * (`subscriptionRateLimits.primary/secondary` → usedPercent / resetsAt), but scoped to a
 * single account so each provider-account card can show its own 5h / weekly windows.
 */

/** One usage window ready for display (matches `ClaudeAccountUsageWindowDto`). */
export interface AccountUsageWindow {
  /** Percent of the window consumed, clamped to 0..100. */
  usedPercent: number;
  /** When the window resets, epoch milliseconds, or null when unknown. */
  resetsAtMs: number | null;
  /** Short window label, e.g. "5h", "Weekly". */
  label: string;
}

const WEEKLY_WINDOW_MINS = 10_080;

interface RawWindow {
  usedPercent?: unknown;
  windowDurationMins?: unknown;
  resetsAt?: unknown;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Runtime emits resetsAt in seconds (or ms); normalize to epoch milliseconds. */
function normalizeResetsAtMs(value: unknown): number | null {
  const resetsAt = asFiniteNumber(value);
  if (resetsAt === null || resetsAt <= 0) {
    return null;
  }
  return resetsAt < 1_000_000_000_000 ? resetsAt * 1000 : resetsAt;
}

function formatWindowLabel(
  windowDurationMins: number | null,
  fallback: 'Primary' | 'Secondary'
): string {
  if (windowDurationMins === null || windowDurationMins <= 0) {
    return fallback;
  }
  if (windowDurationMins % WEEKLY_WINDOW_MINS === 0) {
    const weeks = windowDurationMins / WEEKLY_WINDOW_MINS;
    return weeks === 1 ? 'Weekly' : `${weeks}w`;
  }
  if (windowDurationMins % 1_440 === 0) {
    return `${windowDurationMins / 1_440}d`;
  }
  if (windowDurationMins % 60 === 0) {
    return `${windowDurationMins / 60}h`;
  }
  return `${windowDurationMins}m`;
}

function mapWindow(
  window: RawWindow | null | undefined,
  fallback: 'Primary' | 'Secondary'
): AccountUsageWindow | null {
  const usedPercent = asFiniteNumber(window?.usedPercent);
  if (usedPercent === null) {
    return null;
  }
  return {
    usedPercent: Math.max(0, Math.min(100, usedPercent)),
    resetsAtMs: normalizeResetsAtMs(window?.resetsAt),
    label: formatWindowLabel(asFiniteNumber(window?.windowDurationMins), fallback),
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? tryParse(trimmed.slice(start, end + 1)) : null;
}

function isSubscriptionAuthMethod(authMethod: unknown): boolean {
  return authMethod === 'claude.ai' || authMethod === 'oauth_token';
}

/**
 * Parses the anthropic provider's subscription usage windows from a `runtime status` JSON
 * payload. Returns `[]` when usage is unavailable (no rate limits, API-key auth, malformed
 * output) so callers can treat absence uniformly.
 */
export function parseAnthropicAccountUsage(rawJson: string): AccountUsageWindow[] {
  const root = extractJsonObject(rawJson);
  const providers = root?.providers;
  const anthropic =
    providers && typeof providers === 'object' && !Array.isArray(providers)
      ? (providers as Record<string, unknown>).anthropic
      : null;
  if (!anthropic || typeof anthropic !== 'object') {
    return [];
  }

  const provider = anthropic as Record<string, unknown>;
  if (!isSubscriptionAuthMethod(provider.authMethod)) {
    return [];
  }

  const rateLimits = provider.subscriptionRateLimits;
  if (!rateLimits || typeof rateLimits !== 'object') {
    return [];
  }

  const snapshot = rateLimits as { primary?: RawWindow | null; secondary?: RawWindow | null };
  const windows: AccountUsageWindow[] = [];
  const primary = mapWindow(snapshot.primary, 'Primary');
  if (primary) {
    windows.push(primary);
  }
  const secondary = mapWindow(snapshot.secondary, 'Secondary');
  if (secondary) {
    windows.push(secondary);
  }
  return windows;
}
