import {
  CLAUDE_ACCOUNT_GET_SNAPSHOT,
  CLAUDE_ACCOUNT_REFRESH_SNAPSHOT,
} from '@features/claude-account/contracts';

import type { ClaudeAccountFeatureFacade } from '../../../composition/createClaudeAccountFeature';
import type { IpcMain } from 'electron';

export function registerClaudeAccountIpc(
  ipcMain: IpcMain,
  feature: ClaudeAccountFeatureFacade
): void {
  ipcMain.handle(CLAUDE_ACCOUNT_GET_SNAPSHOT, () => feature.getSnapshot());
  ipcMain.handle(CLAUDE_ACCOUNT_REFRESH_SNAPSHOT, () => feature.refreshSnapshot());
}

export function removeClaudeAccountIpc(ipcMain: IpcMain): void {
  ipcMain.removeHandler(CLAUDE_ACCOUNT_GET_SNAPSHOT);
  ipcMain.removeHandler(CLAUDE_ACCOUNT_REFRESH_SNAPSHOT);
}
