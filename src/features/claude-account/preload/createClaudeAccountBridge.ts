import {
  CLAUDE_ACCOUNT_CREATE_PROFILE,
  CLAUDE_ACCOUNT_GET_SNAPSHOT,
  CLAUDE_ACCOUNT_GET_USAGE,
  CLAUDE_ACCOUNT_GET_VALIDATION,
  CLAUDE_ACCOUNT_RECONNECT,
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
    getClaudeAccountUsage: (configDir, force) =>
      ipcRenderer.invoke(CLAUDE_ACCOUNT_GET_USAGE, configDir, force),
    getClaudeAccountValidation: (configDir, force) =>
      ipcRenderer.invoke(CLAUDE_ACCOUNT_GET_VALIDATION, configDir, force),
    reconnectClaudeAccount: (configDir) => ipcRenderer.invoke(CLAUDE_ACCOUNT_RECONNECT, configDir),
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
