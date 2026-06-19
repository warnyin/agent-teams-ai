// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  CLAUDE_ACCOUNT_GET_SNAPSHOT,
  CLAUDE_ACCOUNT_GET_USAGE,
  CLAUDE_ACCOUNT_GET_VALIDATION,
  CLAUDE_ACCOUNT_RECONNECT,
  CLAUDE_ACCOUNT_REFRESH_SNAPSHOT,
  CLAUDE_ACCOUNT_SNAPSHOT_CHANGED,
} from '@features/claude-account/contracts';
import { createClaudeAccountBridge } from '@features/claude-account/preload/createClaudeAccountBridge';

import type { IpcRenderer } from 'electron';

function makeIpcRenderer() {
  return {
    invoke: vi.fn().mockResolvedValue({ accounts: [], defaultConfigDir: '/x', updatedAt: 't' }),
    on: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as IpcRenderer & {
    invoke: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
}

describe('createClaudeAccountBridge', () => {
  it('invokes the snapshot channels', async () => {
    const ipcRenderer = makeIpcRenderer();
    const bridge = createClaudeAccountBridge({ ipcRenderer });

    await bridge.getClaudeAccountSnapshot();
    await bridge.refreshClaudeAccountSnapshot();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CLAUDE_ACCOUNT_GET_SNAPSHOT);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CLAUDE_ACCOUNT_REFRESH_SNAPSHOT);
  });

  it('invokes the usage channel with the config dir and force flag', async () => {
    const ipcRenderer = makeIpcRenderer();
    const bridge = createClaudeAccountBridge({ ipcRenderer });

    await bridge.getClaudeAccountUsage('C:/Users/me/.claude-profile-01');
    await bridge.getClaudeAccountUsage('C:/Users/me/.claude-profile-01', true);

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      CLAUDE_ACCOUNT_GET_USAGE,
      'C:/Users/me/.claude-profile-01',
      undefined
    );
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      CLAUDE_ACCOUNT_GET_USAGE,
      'C:/Users/me/.claude-profile-01',
      true
    );
  });

  it('invokes the validation channel with the config dir and force flag', async () => {
    const ipcRenderer = makeIpcRenderer();
    const bridge = createClaudeAccountBridge({ ipcRenderer });

    await bridge.getClaudeAccountValidation('C:/Users/me/.claude-max1');
    await bridge.getClaudeAccountValidation('C:/Users/me/.claude-max1', true);

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      CLAUDE_ACCOUNT_GET_VALIDATION,
      'C:/Users/me/.claude-max1',
      undefined
    );
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      CLAUDE_ACCOUNT_GET_VALIDATION,
      'C:/Users/me/.claude-max1',
      true
    );
  });

  it('invokes the reconnect channel with the config dir', async () => {
    const ipcRenderer = makeIpcRenderer();
    const bridge = createClaudeAccountBridge({ ipcRenderer });

    await bridge.reconnectClaudeAccount('C:/Users/me/.claude-max1');

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      CLAUDE_ACCOUNT_RECONNECT,
      'C:/Users/me/.claude-max1'
    );
  });

  it('subscribes and returns an unsubscribe that removes the listener', () => {
    const ipcRenderer = makeIpcRenderer();
    const bridge = createClaudeAccountBridge({ ipcRenderer });
    const callback = vi.fn();

    const unsubscribe = bridge.onClaudeAccountSnapshotChanged(callback);
    expect(ipcRenderer.on).toHaveBeenCalledWith(CLAUDE_ACCOUNT_SNAPSHOT_CHANGED, callback);

    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      CLAUDE_ACCOUNT_SNAPSHOT_CHANGED,
      callback
    );
  });
});
