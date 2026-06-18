// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  CLAUDE_ACCOUNT_GET_SNAPSHOT,
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
