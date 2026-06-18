import type { InlineChip } from '@renderer/types/inlineChip';
import type {
  AccountBindingByProvider,
  EffortLevel,
  TeamFastMode,
  TeamMemberMcpPolicy,
  TeamProviderBackendId,
  TeamProviderId,
} from '@shared/types';

export interface MemberDraft {
  id: string;
  name: string;
  originalName?: string;
  roleSelection: string;
  customRole: string;
  workflow?: string;
  workflowChips?: InlineChip[];
  isolation?: 'worktree';
  providerId?: TeamProviderId;
  providerBackendId?: TeamProviderBackendId;
  model?: string;
  effort?: EffortLevel;
  fastMode?: TeamFastMode;
  mcpPolicy?: TeamMemberMcpPolicy;
  /** Per-member, per-provider account binding (e.g. anthropic → CLAUDE_CONFIG_DIR). */
  accountBindingByProvider?: AccountBindingByProvider;
  removedAt?: number | string | null;
}

export interface MembersEditorValue {
  members: MemberDraft[];
}
