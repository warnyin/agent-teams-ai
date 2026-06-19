# Tech Stack

Two cooperating codebases: the **desktop app** (this repo) and the **orchestrator runtime**
(a separate Bun CLI). The app drives the runtime binary to launch and coordinate agent teams.

## Desktop app — `agent-teams-ai` (v2.1.2)

Electron + React, local-first. Code is split across main / preload / renderer with feature slices.

### Core

| Area | Tech | Version |
|------|------|---------|
| Shell | Electron | ^40.10.0 |
| UI | React + React DOM | ^19.0.0 |
| Language | TypeScript | ^5.9.3 |
| State | Zustand | ^4.5.0 |
| Styling | Tailwind CSS | ^3.4.1 |
| Icons | lucide-react | ^0.577.0 |
| i18n | i18next / react-i18next | 26.2.0 / 17.0.8 |
| Terminal | @xterm/xterm | ^6.0.0 |

### Build & tooling

| Area | Tech | Version |
|------|------|---------|
| Bundler / dev | electron-vite | ^5.0.0 |
| Underlying | Vite | ^6.4.3 |
| Packaging | electron-builder | ^26.8.1 |
| Tests | Vitest | ^3.2.5 |
| E2E / automation | Playwright (electron, CDP `:9222` via `dev:mcp`) | — |
| Lint | ESLint | ^9.39.4 |
| Format | Prettier | ^3.8.1 |
| Dead-code | knip | ^5.82.1 |
| Package manager | **pnpm** 10.33.4 (always pnpm, never npm/yarn) | — |

### Conventions

- **Path aliases:** `@main/*`, `@renderer/*`, `@shared/*`, `@preload/*`, `@features/*`.
- **Feature slices:** `src/features/<name>/` per [`FEATURE_ARCHITECTURE_STANDARD.md`](FEATURE_ARCHITECTURE_STANDARD.md) (contracts / core / main / preload / renderer).
- **Process boundaries:** main = Node/Electron + IPC; preload = context-bridge; renderer = React via `@renderer/api` (never `window.electronAPI` directly).
- **Data sources:** `~/.claude/projects/<encoded-path>/*.jsonl` (sessions), `~/.claude/teams/<team>/config.json` (teams), `~/.claude/todos/<sessionId>.json`.

### Key commands

```bash
pnpm dev            # Electron app, hot reload
pnpm dev:mcp        # dev + CDP :9222 (playwright-electron) + resolves runtime
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint src/ (do NOT run lint:fix during parallel agents)
pnpm test           # vitest
pnpm check          # types + lint + test + build
```

## Orchestrator runtime — `claude-multimodel` (v2.1.87)

A Bun-compiled CLI (binary name `claude-multimodel`) that spawns and coordinates teammates
across Claude / Codex / OpenCode. The app invokes it and parses its `stream-json` stdout.

| Area | Tech | Version |
|------|------|---------|
| Runtime + build | **Bun** | 1.3.11 |
| TUI | React + ink | ^19.2.4 / ^6.8.0 |
| Validation | zod | ^4.3.6 |
| Agents/SDK | @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk | — |
| Build | `bun build --compile` → single binary (`scripts/build.ts`) | — |

```bash
bun run build:dev   # compile dev binary → ./cli-dev  (feature set: VOICE_MODE)
bun test <file>     # unit tests (pure leaf modules)
```

> **Source note:** the buildable full source is private (`777genius/agent_teams_orchestrator`).
> The public mirror `warnyin/claude-multimodel` is a partial reconstruction (~199 modules
> missing) and cannot be compiled. See [features/multi-account-claude.md](features/multi-account-claude.md#blockers).

## App ↔ runtime integration

- **Resolution** (`scripts/dev-with-runtime.mjs`): `CLAUDE_AGENT_TEAMS_ORCHESTRATOR_CLI_PATH`
  (explicit binary) → `CLAUDE_DEV_RUNTIME_ROOT` (build from a local runtime repo) → download the
  release pinned in [`runtime.lock.json`](../runtime.lock.json).
- **Pinned release:** `runtime.lock.json` → version `0.0.54`, assets per platform
  (`darwin-arm64/x64`, `linux-x64`, `win32-x64`), released from `777genius/agent-teams-ai`.
- **Launch contract:** the app spawns the runtime, feeds the lead via stdin (stream-json), and
  parses stream-json stdout for per-member spawn lifecycle, bootstrap confirmation, and session
  evidence (see [`docs/team-management/`](team-management/)).
- **Accounts:** the app passes per-team/per-member account bindings through
  `~/.claude/teams/<team>/config.json`; the runtime applies them as `CLAUDE_CONFIG_DIR` per
  teammate at spawn. See [features/multi-account-claude.md](features/multi-account-claude.md).

## Providers / runtimes supported

Anthropic (Claude), Codex (ChatGPT), OpenCode — each with its own account/runtime feature slice
(`src/features/claude-account`, `src/features/codex-account`, OpenCode runtime installer).
