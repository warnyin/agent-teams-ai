# Multi-Account Claude (Anthropic) Support

**Status:** P0–P3 implemented & tested · P4 (Codex) deferred · runtime live-test blocked (see [Blockers](#blockers))
**Feature slice:** `src/features/claude-account/`
**Runtime side:** `warnyin/claude-multimodel` branch `feat/per-member-claude-config-dir`

## Problem

The app authenticated as a **single** Anthropic account. Power users have several
subscriptions (Pro / multiple Max) and want to:

- connect more than one Anthropic account at once,
- see every account's status & usage in the Providers panel,
- bind a specific account **per team** and **per teammate** (e.g. `alice → Max1`, `tom → Max2`).

The mechanism is Claude's `CLAUDE_CONFIG_DIR`: **one config dir = one account** (it holds that
account's `.credentials.json`). Switching the env var switches the active account.

> **Issue #27 (critical invariant):** never set `CLAUDE_CONFIG_DIR` to the default `~/.claude`.
> Doing so changes the macOS Keychain OAuth namespace and breaks subscription auth. The default
> account always binds to `null` / omits the env var. This rule is enforced in **both** repos.

## Account model

| Concept | Meaning |
|---------|---------|
| Default account | `~/.claude` — bound as `null` (env omitted), issue #27 |
| Added account | `~/.claude-profile-NN` (running-numbered) or user dirs like `~/.claude-max1` |
| Account id | the config dir path (stable, unique) |
| Binding | `accountBindingByProvider: Partial<Record<TeamProviderId, string \| null>>` — generic per provider; `anthropic` value is a `CLAUDE_CONFIG_DIR` |

`null` = default account (omit env) · `undefined`/absent = inherit the team account · a dir = that account.

## Architecture — `src/features/claude-account/`

Follows [`docs/FEATURE_ARCHITECTURE_STANDARD.md`](../FEATURE_ARCHITECTURE_STANDARD.md)
(contracts / core / main / preload / renderer; `core/` is side-effect free; the renderer talks
through `@renderer/api`, never `window.electronAPI`).

```
contracts/            channels, DTOs, ElectronApi fragment (browser-safe)
core/
  domain/             parseClaudeAuthStatus, accountIdentity, parseAccountUsage,
                      accountConnectivity            (pure, unit-tested)
  application/        ports, listAccounts             (use-cases over ports)
main/
  infrastructure/     discoverClaudeConfigDirs, ClaudeAuthStatusProbe,
                      ClaudeAccountUsageProbe, ClaudeAccountValidationProbe,
                      createClaudeProfile, loginClaudeAccount
  composition/        createClaudeAccountFeature      (facade: cache + dedup + presenter)
  adapters/           IPC registration, snapshot presenter
preload/              createClaudeAccountBridge
renderer/
  hooks/              useClaudeAccounts, useClaudeAccountUsage, useClaudeAccountValidation
  ui/                 ClaudeAccountPicker
  toProviderAccounts  map → provider-agnostic ProviderAccount[]
```

### Facade (`createClaudeAccountFeature`)

- `getSnapshot()` / `refreshSnapshot()` — account list (discovery + `claude auth status` probe), 30s cache + in-flight dedup, broadcasts changes.
- `getAccountUsage(configDir, force?)` — per-account 5h/weekly windows (lazy, 30s cache).
- `getAccountValidation(configDir, force?)` — live server-side token check (lazy, 5min cache).
- `createProfile(options?)` — allocate `~/.claude-profile-NN`, run `claude auth login`.
- `reconnectAccount(configDir)` — re-auth an existing dir; invalidates its usage/validation cache.

## Per-team & per-member binding (app ↔ runtime)

Teammates are spawned by the **orchestrator runtime**, not the app — so per-member binding
needs both sides:

**App** writes the binding into the team `config.json` it already owns:

```
~/.claude/teams/<team>/config.json
{
  "accountBindingByProvider": { "anthropic": "<lead dir|null>" },
  "members": [
    { "name": "alice", "accountBindingByProvider": { "anthropic": "~/.claude-max1" } },
    { "name": "tom",   "accountBindingByProvider": { "anthropic": "~/.claude-max2" } }
  ]
}
```

Writer: `TeamProvisioningService.writeOpenCodeTeamConfig` (verbatim passthrough of each member's binding).

**Runtime** (`feat/per-member-claude-config-dir`) reads it at spawn time:

| Runtime symbol | File | Role |
|----------------|------|------|
| `resolveMemberClaudeConfigDirBinding(team, member)` | `src/utils/swarm/teamHelpers.ts` | read `member.accountBindingByProvider?.anthropic` from config.json |
| `resolveBoundTeammateConfigDir(override)` | `src/utils/swarm/claudeConfigDirBinding.ts` | decide the dir to set (trimmed, non-empty, non-default) or `null` |
| `isDefaultClaudeConfigDir(dir)` | `src/utils/swarm/claudeConfigDirBinding.ts` | enforce issue #27 |
| `buildInheritedEnvVars({claudeConfigDirOverride})` | `src/utils/swarm/spawnUtils.ts` | build the teammate spawn env string |

Spawn sites: `src/tools/shared/spawnMultiAgent.ts`, `src/utils/swarm/backends/PaneBackendExecutor.ts`.

**Env decision** (identical both sides):

| `accountBindingByProvider.anthropic` | spawned `CLAUDE_CONFIG_DIR` |
|--------------------------------------|------------------------------|
| `undefined` / absent | inherit team value |
| `null` / `''` / whitespace | omitted (default account) |
| default `~/.claude` | omitted (issue #27) |
| any other dir | set to that dir |

## Providers panel — provider-account cards

Design: [`docs/research/provider-account-cards-design.md`](../research/provider-account-cards-design.md).
One **card per (provider × account)**, provider-agnostic.

| Type / hook | Purpose |
|-------------|---------|
| `src/renderer/types/providerAccount.ts` | `ProviderAccount` model (id, email, plan, status, usage, connectivity, isActive) |
| `src/renderer/hooks/useProviderAccounts.ts` | aggregates per-provider sources; `createAccount` / `reconnectAccount` / `refreshAccount` |
| `src/renderer/components/dashboard/ProviderAccountCard.tsx` | presentational card (status badge, plan/Active pills, usage chips, Manage/Refresh/Reconnect) |
| `CliStatusBanner.tsx` | renders N cards per provider; "Add Anthropic account"; "X/Y connected" counted over provider-accounts |

### Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| P0 | feature slice, discovery, per-team binding | ✅ |
| P1 | `ProviderAccount` model + N uniform cards | ✅ |
| P2 | per-account usage probe (5h/weekly) → usage chips; lazy+cached+short timeout | ✅ |
| P3 | per-account Manage / Refresh / Reconnect + live connectivity badge | ✅ |
| P4 | plug `codex-account` into the same model | ⏸️ deferred (codex feature exposes only the active account today) |

## Add-account & reconnect flow

1. **Add** — `createProfile` allocates `~/.claude-profile-NN`, runs `claude auth login --claudeai`
   with `CLAUDE_CONFIG_DIR` pinned (browser OAuth). Resolves with the refreshed snapshot.
2. **Reconnect** — `loginClaudeAccount` re-auths an existing dir; usage/validation caches are
   invalidated and force re-probed so a stale "Reconnect" badge clears immediately.

## Testing

- **Domain (app, vitest):** `parseClaudeAuthStatus`, `accountIdentity`, `parseAccountUsage`, `accountConnectivity`.
- **Infra/facade (app):** discovery, auth/usage/validation probes, login, `createClaudeAccountFeature` (incl. `force` cache-bypass).
- **Renderer (app):** `toProviderAccounts`, `useClaudeAccounts`, `useClaudeAccountValidation` (force re-probe / badge clear).
- **Contract (app):** `test/main/services/team/teamConfigAccountBinding.contract.test.ts` — pins the app↔runtime config.json shape and the env decision (incl. issue #27).
- **Runtime (bun):** `src/utils/swarm/claudeConfigDirBinding.test.ts` — per-member binding rules + issue #27.

## Blockers

- **Live test of the per-member runtime change is blocked locally.** A real test needs a runtime
  binary built **with** the change. The public mirror (`warnyin/claude-multimodel`) is a partial
  reconstruction missing ~199 modules (incl. core `types/message.ts`, used by 79 files), so
  `bun run build:dev` cannot complete. The full source `777genius/agent_teams_orchestrator` is
  private and not accessible to this account.
- **Path forward:** build from full private source / CI → publish a release → bump
  `runtime.lock.json`. Until then the logic is covered by the unit + contract tests above, and a
  standalone spawn-harness (real `claude` per member with the resolved env) can demonstrate the
  mechanism end-to-end without the full runtime.

## Key references

- Feature standard: [`docs/FEATURE_ARCHITECTURE_STANDARD.md`](../FEATURE_ARCHITECTURE_STANDARD.md)
- Cards design: [`docs/research/provider-account-cards-design.md`](../research/provider-account-cards-design.md)
- Runtime integration: [`docs/claude-multimodel-integration-plan.md`](../claude-multimodel-integration-plan.md)
- Tech stack: [`docs/TECH_STACK.md`](../TECH_STACK.md)
