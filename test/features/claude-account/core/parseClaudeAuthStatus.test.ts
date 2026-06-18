// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  mapClaudeAuthKind,
  mapClaudePlan,
  parseClaudeAuthStatus,
} from '@features/claude-account/core/domain/parseClaudeAuthStatus';

const LOGGED_IN_JSON = JSON.stringify({
  loggedIn: true,
  authMethod: 'claude.ai',
  apiProvider: 'firstParty',
  email: 'claude-dev1@ofm.co.th',
  orgId: '9dad7a54-ab75-4f21-ace6-4e1bad7178f3',
  orgName: "claude-dev1@ofm.co.th's Organization",
  subscriptionType: 'max',
});

describe('parseClaudeAuthStatus', () => {
  it('parses a logged-in JSON payload', () => {
    expect(parseClaudeAuthStatus(LOGGED_IN_JSON)).toEqual({
      loggedIn: true,
      email: 'claude-dev1@ofm.co.th',
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      subscriptionType: 'max',
      orgName: "claude-dev1@ofm.co.th's Organization",
      orgId: '9dad7a54-ab75-4f21-ace6-4e1bad7178f3',
    });
  });

  it('tolerates surrounding log lines around the JSON object', () => {
    const noisy = `Some warning to stderr\n${LOGGED_IN_JSON}\nextra trailing line`;
    expect(parseClaudeAuthStatus(noisy).email).toBe('claude-dev1@ofm.co.th');
    expect(parseClaudeAuthStatus(noisy).loggedIn).toBe(true);
  });

  it('treats loggedIn:false as logged out', () => {
    const result = parseClaudeAuthStatus(JSON.stringify({ loggedIn: false }));
    expect(result.loggedIn).toBe(false);
    expect(result.email).toBeNull();
  });

  it('treats unparseable output as logged out', () => {
    expect(parseClaudeAuthStatus('not json at all').loggedIn).toBe(false);
    expect(parseClaudeAuthStatus('').loggedIn).toBe(false);
  });

  it('returns null fields when keys are missing or blank', () => {
    const result = parseClaudeAuthStatus(JSON.stringify({ loggedIn: true, email: '   ' }));
    expect(result.loggedIn).toBe(true);
    expect(result.email).toBeNull();
    expect(result.subscriptionType).toBeNull();
  });
});

describe('mapClaudePlan', () => {
  it('maps known subscription types', () => {
    expect(mapClaudePlan('max')).toBe('max');
    expect(mapClaudePlan('Pro')).toBe('pro');
    expect(mapClaudePlan('enterprise')).toBe('enterprise');
  });

  it('falls back to unknown for null or unrecognized values', () => {
    expect(mapClaudePlan(null)).toBe('unknown');
    expect(mapClaudePlan('platinum')).toBe('unknown');
  });
});

describe('mapClaudeAuthKind', () => {
  it('maps first-party / claude.ai to subscription', () => {
    expect(mapClaudeAuthKind('firstParty', 'claude.ai')).toBe('subscription');
  });

  it('maps bedrock provider to bedrock', () => {
    expect(mapClaudeAuthKind('bedrock', null)).toBe('bedrock');
  });

  it('maps anthropic api provider to api_key', () => {
    expect(mapClaudeAuthKind('anthropic', 'apiKey')).toBe('api_key');
  });

  it('falls back to unknown', () => {
    expect(mapClaudeAuthKind(null, null)).toBe('unknown');
  });
});
