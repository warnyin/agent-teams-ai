import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useClaudeAccountValidation,
  type UseClaudeAccountValidationResult,
} from '../../../../src/features/claude-account/renderer/hooks/useClaudeAccountValidation';

import type { ClaudeAccountDto } from '@features/claude-account/contracts';

const apiMocks = vi.hoisted(() => ({
  getClaudeAccountValidation: vi.fn(),
}));

vi.mock('@renderer/api', () => ({
  api: apiMocks,
  isElectronMode: () => true,
}));

const CONFIG_DIR = 'C:/Users/me/.claude-max1';

function account(overrides: Partial<ClaudeAccountDto> = {}): ClaudeAccountDto {
  return {
    id: CONFIG_DIR,
    label: 'Max1',
    configDir: CONFIG_DIR,
    isDefault: false,
    loginStatus: 'logged_in',
    email: 'max1@x.com',
    plan: 'max',
    authKind: 'subscription',
    orgName: 'Org',
    hasCredentials: true,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let latest: UseClaudeAccountValidationResult | null;

function Harness({ accounts }: { accounts: ClaudeAccountDto[] }): null {
  latest = useClaudeAccountValidation(accounts);
  return null;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  apiMocks.getClaudeAccountValidation.mockReset();
  latest = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useClaudeAccountValidation', () => {
  it('probes connected accounts on mount and exposes the verdict', async () => {
    apiMocks.getClaudeAccountValidation.mockResolvedValue({ configDir: CONFIG_DIR, result: 'invalid' });

    await act(async () => {
      root.render(React.createElement(Harness, { accounts: [account()] }));
    });
    await flush();

    expect(apiMocks.getClaudeAccountValidation).toHaveBeenCalledWith(CONFIG_DIR);
    expect((latest as UseClaudeAccountValidationResult).connectivityByConfigDir.get(CONFIG_DIR)).toBe(
      'invalid'
    );
  });

  it('refresh() force re-probes and merges the fresh verdict (clears a stale badge)', async () => {
    apiMocks.getClaudeAccountValidation.mockResolvedValueOnce({
      configDir: CONFIG_DIR,
      result: 'invalid',
    });

    await act(async () => {
      root.render(React.createElement(Harness, { accounts: [account()] }));
    });
    await flush();
    expect((latest as UseClaudeAccountValidationResult).connectivityByConfigDir.get(CONFIG_DIR)).toBe(
      'invalid'
    );

    // Simulate a successful reconnect flipping the server verdict to valid.
    apiMocks.getClaudeAccountValidation.mockResolvedValueOnce({
      configDir: CONFIG_DIR,
      result: 'valid',
    });
    await act(async () => {
      await (latest as UseClaudeAccountValidationResult).refresh(CONFIG_DIR);
    });

    expect(apiMocks.getClaudeAccountValidation).toHaveBeenLastCalledWith(CONFIG_DIR, true);
    expect((latest as UseClaudeAccountValidationResult).connectivityByConfigDir.get(CONFIG_DIR)).toBe(
      'valid'
    );
  });

  it('refresh() records unknown when the probe throws', async () => {
    apiMocks.getClaudeAccountValidation.mockResolvedValueOnce({
      configDir: CONFIG_DIR,
      result: 'invalid',
    });

    await act(async () => {
      root.render(React.createElement(Harness, { accounts: [account()] }));
    });
    await flush();

    apiMocks.getClaudeAccountValidation.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await (latest as UseClaudeAccountValidationResult).refresh(CONFIG_DIR);
    });

    expect((latest as UseClaudeAccountValidationResult).connectivityByConfigDir.get(CONFIG_DIR)).toBe(
      'unknown'
    );
  });
});
