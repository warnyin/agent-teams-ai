import type { ClaudeAccountSnapshotDto } from './dto';

export interface ClaudeAccountElectronApi {
  getClaudeAccountSnapshot: () => Promise<ClaudeAccountSnapshotDto>;
  refreshClaudeAccountSnapshot: () => Promise<ClaudeAccountSnapshotDto>;
  onClaudeAccountSnapshotChanged: (
    callback: (event: unknown, snapshot: ClaudeAccountSnapshotDto) => void
  ) => () => void;
}
