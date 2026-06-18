import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useClaudeAccounts,
  type UseClaudeAccountsResult,
} from '../../../../src/features/claude-account/renderer/hooks/useClaudeAccounts';

import type { ClaudeAccountSnapshotDto } from '@features/claude-account/contracts';

const apiMocks = vi.hoisted(() => ({
  getClaudeAccountSnapshot: vi.fn(),
  refreshClaudeAccountSnapshot: vi.fn(),
  onClaudeAccountSnapshotChanged: vi.fn<
    (callback: (event: unknown, snapshot: ClaudeAccountSnapshotDto) => void) => () => void
  >(() => () => undefined),
}));

vi.mock('@renderer/api', () => ({
  api: apiMocks,
  isElectronMode: () => true,
}));

function snapshot(overrides: Partial<ClaudeAccountSnapshotDto> = {}): ClaudeAccountSnapshotDto {
  return {
    accounts: [
      {
        id: 'C:/Users/me/.claude',
        label: 'Default',
        configDir: 'C:/Users/me/.claude',
        isDefault: true,
        loginStatus: 'logged_in',
        email: 'default@x.com',
        plan: 'max',
        authKind: 'subscription',
        orgName: 'Org',
        hasCredentials: true,
      },
    ],
    defaultConfigDir: 'C:/Users/me/.claude',
    updatedAt: '2026-06-18T00:00:00.000Z',
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let latest: UseClaudeAccountsResult | null;

function Harness(): null {
  latest = useClaudeAccounts();
  return null;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  apiMocks.getClaudeAccountSnapshot.mockReset().mockResolvedValue(snapshot());
  apiMocks.refreshClaudeAccountSnapshot.mockReset().mockResolvedValue(snapshot());
  apiMocks.onClaudeAccountSnapshotChanged.mockReset().mockReturnValue(() => undefined);
  latest = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useClaudeAccounts', () => {
  it('loads the snapshot on mount and exposes accounts', async () => {
    await act(async () => {
      root.render(React.createElement(Harness));
    });
    await flush();

    expect(apiMocks.getClaudeAccountSnapshot).toHaveBeenCalledTimes(1);
    expect((latest as UseClaudeAccountsResult).accounts).toHaveLength(1);
    expect((latest as UseClaudeAccountsResult).accounts[0].email).toBe('default@x.com');
    expect((latest as UseClaudeAccountsResult).defaultConfigDir).toBe('C:/Users/me/.claude');
  });

  it('refresh() calls the refresh transport', async () => {
    await act(async () => {
      root.render(React.createElement(Harness));
    });
    await flush();

    await act(async () => {
      await (latest as UseClaudeAccountsResult).refresh();
    });

    expect(apiMocks.refreshClaudeAccountSnapshot).toHaveBeenCalledTimes(1);
  });

  it('subscribes to snapshot changes and updates accounts', async () => {
    let pushed: ((event: unknown, snap: ClaudeAccountSnapshotDto) => void) | null = null;
    apiMocks.onClaudeAccountSnapshotChanged.mockImplementation((cb) => {
      pushed = cb;
      return () => undefined;
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });
    await flush();

    await act(async () => {
      pushed?.(null, snapshot({ accounts: [] }));
    });

    expect((latest as UseClaudeAccountsResult).accounts).toHaveLength(0);
  });
});
