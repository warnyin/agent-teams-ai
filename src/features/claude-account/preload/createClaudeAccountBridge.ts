import {
  CLAUDE_ACCOUNT_CREATE_PROFILE,
  CLAUDE_ACCOUNT_GET_SNAPSHOT,
  CLAUDE_ACCOUNT_REFRESH_SNAPSHOT,
  CLAUDE_ACCOUNT_SNAPSHOT_CHANGED,
  type ClaudeAccountElectronApi,
} from '@features/claude-account/contracts';

import type { IpcRenderer } from 'electron';

interface CreateClaudeAccountBridgeDeps {
  ipcRenderer: IpcRenderer;
}

export function createClaudeAccountBridge({
  ipcRenderer,
}: CreateClaudeAccountBridgeDeps): ClaudeAccountElectronApi {
  return {
    getClaudeAccountSnapshot: () => ipcRenderer.invoke(CLAUDE_ACCOUNT_GET_SNAPSHOT),
    refreshClaudeAccountSnapshot: () => ipcRenderer.invoke(CLAUDE_ACCOUNT_REFRESH_SNAPSHOT),
    createClaudeAccountProfile: (options) =>
      options === undefined
        ? ipcRenderer.invoke(CLAUDE_ACCOUNT_CREATE_PROFILE)
        : ipcRenderer.invoke(CLAUDE_ACCOUNT_CREATE_PROFILE, options),
    onClaudeAccountSnapshotChanged: (callback) => {
      ipcRenderer.on(
        CLAUDE_ACCOUNT_SNAPSHOT_CHANGED,
        callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
      );
      return (): void => {
        ipcRenderer.removeListener(
          CLAUDE_ACCOUNT_SNAPSHOT_CHANGED,
          callback as (event: Electron.IpcRendererEvent, ...args: unknown[]) => void
        );
      };
    },
  };
}
