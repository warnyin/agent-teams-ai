import {
  CLAUDE_ACCOUNT_CREATE_PROFILE,
  CLAUDE_ACCOUNT_GET_SNAPSHOT,
  CLAUDE_ACCOUNT_GET_USAGE,
  CLAUDE_ACCOUNT_GET_VALIDATION,
  CLAUDE_ACCOUNT_RECONNECT,
  CLAUDE_ACCOUNT_REFRESH_SNAPSHOT,
  type CreateClaudeAccountProfileOptions,
} from '@features/claude-account/contracts';

import type { ClaudeAccountFeatureFacade } from '../../../composition/createClaudeAccountFeature';
import type { IpcMain } from 'electron';

export function registerClaudeAccountIpc(
  ipcMain: IpcMain,
  feature: ClaudeAccountFeatureFacade
): void {
  ipcMain.handle(CLAUDE_ACCOUNT_GET_SNAPSHOT, () => feature.getSnapshot());
  ipcMain.handle(CLAUDE_ACCOUNT_REFRESH_SNAPSHOT, () => feature.refreshSnapshot());
  ipcMain.handle(
    CLAUDE_ACCOUNT_CREATE_PROFILE,
    (_event, options?: CreateClaudeAccountProfileOptions) => feature.createProfile(options)
  );
  ipcMain.handle(CLAUDE_ACCOUNT_GET_USAGE, (_event, configDir: unknown, force?: unknown) => {
    if (typeof configDir !== 'string' || configDir.trim().length === 0) {
      throw new Error('claudeAccount:getUsage requires a non-empty configDir');
    }
    return feature.getAccountUsage(configDir, force === true);
  });
  ipcMain.handle(CLAUDE_ACCOUNT_GET_VALIDATION, (_event, configDir: unknown, force?: unknown) => {
    if (typeof configDir !== 'string' || configDir.trim().length === 0) {
      throw new Error('claudeAccount:getValidation requires a non-empty configDir');
    }
    return feature.getAccountValidation(configDir, force === true);
  });
  ipcMain.handle(CLAUDE_ACCOUNT_RECONNECT, (_event, configDir: unknown) => {
    if (typeof configDir !== 'string' || configDir.trim().length === 0) {
      throw new Error('claudeAccount:reconnect requires a non-empty configDir');
    }
    return feature.reconnectAccount(configDir);
  });
}

export function removeClaudeAccountIpc(ipcMain: IpcMain): void {
  ipcMain.removeHandler(CLAUDE_ACCOUNT_GET_SNAPSHOT);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_REFRESH_SNAPSHOT);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_CREATE_PROFILE);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_GET_USAGE);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_GET_VALIDATION);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_RECONNECT);
}
