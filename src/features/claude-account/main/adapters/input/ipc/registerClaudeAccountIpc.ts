import {
  CLAUDE_ACCOUNT_CREATE_PROFILE,
  CLAUDE_ACCOUNT_GET_SNAPSHOT,
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
}

export function removeClaudeAccountIpc(ipcMain: IpcMain): void {
  ipcMain.removeHandler(CLAUDE_ACCOUNT_GET_SNAPSHOT);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_REFRESH_SNAPSHOT);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_CREATE_PROFILE);
}
