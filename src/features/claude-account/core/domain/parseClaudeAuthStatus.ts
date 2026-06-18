import type { ClaudeAccountAuthKind, ClaudeAccountPlan } from '@features/claude-account/contracts';

/**
 * Structured result of `claude auth status`, which emits a single JSON object such as:
 * {
 *   "loggedIn": true,
 *   "authMethod": "claude.ai",
 *   "apiProvider": "firstParty",
 *   "email": "user@example.com",
 *   "orgId": "...",
 *   "orgName": "...",
 *   "subscriptionType": "max"
 * }
 */
export interface ClaudeAuthStatusResult {
  loggedIn: boolean;
  email: string | null;
  authMethod: string | null;
  apiProvider: string | null;
  subscriptionType: string | null;
  orgName: string | null;
  orgId: string | null;
}

const LOGGED_OUT: ClaudeAuthStatusResult = {
  loggedIn: false,
  email: null,
  authMethod: null,
  apiProvider: null,
  subscriptionType: null,
  orgName: null,
  orgId: null,
};

function extractJsonObject(stdout: string): string | null {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return stdout.slice(start, end + 1);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Pure parser for `claude auth status` stdout. Tolerant of surrounding log lines and
 * of missing/garbage output (treated as logged out).
 */
export function parseClaudeAuthStatus(stdout: string): ClaudeAuthStatusResult {
  const jsonText = extractJsonObject(stdout ?? '');
  if (!jsonText) {
    return LOGGED_OUT;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return LOGGED_OUT;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return LOGGED_OUT;
  }

  const record = parsed as Record<string, unknown>;
  if (record.loggedIn !== true) {
    return LOGGED_OUT;
  }

  return {
    loggedIn: true,
    email: readString(record, 'email'),
    authMethod: readString(record, 'authMethod'),
    apiProvider: readString(record, 'apiProvider'),
    subscriptionType: readString(record, 'subscriptionType'),
    orgName: readString(record, 'orgName'),
    orgId: readString(record, 'orgId'),
  };
}

export function mapClaudePlan(subscriptionType: string | null): ClaudeAccountPlan {
  switch ((subscriptionType ?? '').toLowerCase()) {
    case 'free':
      return 'free';
    case 'pro':
      return 'pro';
    case 'max':
      return 'max';
    case 'team':
      return 'team';
    case 'enterprise':
      return 'enterprise';
    default:
      return 'unknown';
  }
}

export function mapClaudeAuthKind(
  apiProvider: string | null,
  authMethod: string | null
): ClaudeAccountAuthKind {
  const provider = (apiProvider ?? '').toLowerCase();
  const method = (authMethod ?? '').toLowerCase();

  if (provider === 'bedrock' || provider === 'vertex' || method.includes('bedrock')) {
    return 'bedrock';
  }
  if (provider === 'firstparty' || method === 'claude.ai') {
    return 'subscription';
  }
  if (provider === 'anthropic' || method.includes('api') || method.includes('key')) {
    return 'api_key';
  }
  return 'unknown';
}
