import {
  CLAUDE_ACCOUNT_SNAPSHOT_CHANGED,
  type ClaudeAccountSnapshotDto,
} from '@features/claude-account/contracts';
import { safeSendToRenderer } from '@main/utils/safeWebContentsSend';

import type { BrowserWindow } from 'electron';

export class ClaudeAccountSnapshotPresenter {
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  publish(snapshot: ClaudeAccountSnapshotDto): void {
    safeSendToRenderer(this.mainWindow, CLAUDE_ACCOUNT_SNAPSHOT_CHANGED, snapshot);
  }
}
