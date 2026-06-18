/**
 * Pure resolution of which Claude `CLAUDE_CONFIG_DIR` a team's runtime should use.
 *
 * A team may bind to a specific account (a config dir). When it does not, the runtime
 * falls back to the app's global config dir. The default dir (`~/.claude`) must never be
 * set as `CLAUDE_CONFIG_DIR` because that changes the macOS Keychain OAuth namespace and
 * breaks subscription auth (see issue #27) — so `shouldSetConfigDirEnv` is false for it.
 */
export interface TeamClaudeConfigDirResolution {
  configDir: string;
  shouldSetConfigDirEnv: boolean;
}

export interface ResolveTeamClaudeConfigDirInput {
  /** Per-team account binding (a config dir), or null/undefined for no binding. */
  binding: string | null | undefined;
  /** App's current global config dir (`getClaudeBasePath()`). */
  globalConfigDir: string;
  /** Auto-detected default config dir (`getAutoDetectedClaudeBasePath()`). */
  defaultConfigDir: string;
}

function normalizeDir(dir: string): string {
  const unified = (dir ?? '').trim().replace(/\\/g, '/');
  const collapsed = unified.replace(/\/{2,}/g, '/');
  let end = collapsed.length;
  while (end > 1 && collapsed[end - 1] === '/') {
    end -= 1;
  }
  return collapsed.slice(0, end);
}

export function resolveTeamClaudeConfigDir(
  input: ResolveTeamClaudeConfigDirInput
): TeamClaudeConfigDirResolution {
  const bound = input.binding?.trim();
  const configDir = bound && bound.length > 0 ? bound : input.globalConfigDir;
  const shouldSetConfigDirEnv = normalizeDir(configDir) !== normalizeDir(input.defaultConfigDir);
  return { configDir, shouldSetConfigDirEnv };
}
