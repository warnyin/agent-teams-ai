# Provider-Account Cards — Design

**Status**: design (implementation phased)
**Scope**: Dashboard Providers panel (`src/renderer/components/dashboard/CliStatusBanner.tsx`)

## Problem

The Providers panel renders **one card per provider** (`anthropic` / `codex` / `opencode`)
from `cliStatus.providers` (a single `CliProviderStatus` per provider, scoped to the one
runtime-active account). But a provider can now have **multiple accounts**:

- Anthropic — N accounts, one per `CLAUDE_CONFIG_DIR` (the `claude-account` feature).
- Codex — N ChatGPT accounts (`~/.codex/accounts`, the `codex-account` feature).

Today all of an Anthropic user's accounts collapse into one card, and its usage/models
reflect only the active account. We want **one card per provider-account**, generically,
so Anthropic with 3 accounts shows 3 cards and Codex with 2 shows 2.

## Goal

A provider-agnostic model where each provider contributes `0..N` accounts, and the panel
renders **one card per (provider × account)**. Single-account providers (e.g. OpenCode)
keep their current single card. No provider-specific branching in the panel.

## Model

```ts
// src/renderer/types/providerAccount.ts
export type ProviderAccountStatus = 'connected' | 'signed_out' | 'unknown';

export interface ProviderAccountUsageWindow {
  usedPercent: number;        // 0..100
  resetsAtMs: number | null;
  label: string;              // e.g. "5h", "Weekly"
}

export interface ProviderAccount {
  providerId: TeamProviderId;          // anthropic | codex | gemini | opencode
  accountId: string;                   // stable id: configDir (anthropic) / account key (codex)
  providerLabel: string;               // "Anthropic", "Codex"
  email: string | null;
  plan: string | null;                 // "MAX", "PRO", ... (uppercased) | null
  status: ProviderAccountStatus;
  /** The account the runtime currently authenticates as (default config dir, active codex acct). */
  isActive: boolean;
  /** Per-account usage; null until probed (P2). undefined = not applicable for this provider. */
  usage?: ProviderAccountUsageWindow[] | null;
}
```

## Architecture

### Source plugins (per provider, pluggable)

Each provider feature exposes a renderer adapter that maps its own snapshot to
`ProviderAccount[]`. This keeps provider specifics inside the feature.

- **anthropic** — `@features/claude-account/renderer`: `toProviderAccounts(accounts)` from the
  existing `ClaudeAccountDto[]` (configDir → accountId, `isDefault` → `isActive`).
- **codex** — `@features/codex-account/renderer`: adapter over the codex account snapshot
  (P4). Until then codex falls back to a single card.
- **gemini / opencode** — no multi-account source → single card (fallback).

### Aggregator

```ts
// src/renderer/hooks/useProviderAccounts.ts
export function useProviderAccounts(options?: { enabled?: boolean }): {
  accountsByProvider: Partial<Record<TeamProviderId, ProviderAccount[]>>;
  loading: boolean;
}
```

Composes the per-provider sources (claude-account now; codex-account at P4). Returns the
accounts grouped by provider. Lives in the app-shell renderer because it crosses features;
it only depends on each feature's public `renderer` barrel.

### Panel rendering

In `CliStatusBanner`, the provider map becomes:

```
for each visible provider P:
  accounts = accountsByProvider[P.providerId] ?? []
  if accounts.length >= 1:
    render one <ProviderAccountCard> per account   // replaces P's single card
  else:
    render the existing single provider card (P)   // opencode, or no accounts detected
```

`ProviderAccountCard` is a dumb presentational card matching the existing provider card
style: brand logo + `"<ProviderLabel> — <email>"` + subscription status line + plan badge
+ (P2) usage chips + (P3) Manage/Refresh actions scoped to that account.

The original single-provider card is only used as the **fallback** (0 accounts / providers
without a multi-account source), so behavior is unchanged for OpenCode and when detection
yields nothing.

### Connected-count semantics

`formatRuntimeAuthSummary` currently counts `visibleProviders`. It changes to count
**provider-accounts**: `Σ accounts(connected)` over expanded providers, plus single-card
providers. e.g. "Providers: 5/6 connected" when Anthropic has 4/5 logged-in + Codex + OpenCode.
(Exact denominator policy decided in P1; keep counting providers without a source as 1.)

## Per-account data (P2)

Usage (5h / weekly) is per-account and only obtainable by probing each account's runtime:

- anthropic — run `claude-multimodel runtime status --json --provider anthropic --summary`
  with `CLAUDE_CONFIG_DIR` set per account (the same command `ClaudeMultimodelBridgeService`
  uses for the active account). Parse `rateLimits.primary/secondary` (see
  `ClaudeMultimodelBridgeService` mapping: `usedPercent`, `resetsAt`).
- **Cost**: one runtime spawn per account; the summary probe already times out for a single
  account, so per-account probing must be **lazy** (only when the panel is expanded),
  **cached** (≥30s TTL via the feature facade), with a **short timeout** and graceful `N/A`.

This extends the `claude-account` snapshot (or a dedicated usage probe port) — NOT the
synchronous account list — so the card list renders immediately and usage fills in.

## Actions (P3)

Manage / Refresh / Connect-Disconnect move onto each card, scoped to `(providerId, accountId)`.
Manage opens the provider settings (today provider-scoped); per-account management is a
follow-up if/when the settings dialog supports account selection.

## File layout

```
src/renderer/types/providerAccount.ts                      # model (P1)
src/renderer/hooks/useProviderAccounts.ts                  # aggregator (P1)
src/renderer/components/dashboard/ProviderAccountCard.tsx  # presentational card (P1)
src/features/claude-account/renderer/toProviderAccounts.ts # anthropic source (P1)
src/features/codex-account/renderer/toProviderAccounts.ts  # codex source (P4)
```

`CliStatusBanner.tsx` consumes `useProviderAccounts()` and renders `ProviderAccountCard`s,
falling back to the existing provider card.

## Phases

| Phase | Deliverable |
|-------|-------------|
| **P1** | `ProviderAccount` model + aggregator + anthropic source + render Anthropic as N uniform cards (replacing the single Anthropic card). Keep Manage/Refresh per card (no usage yet). |
| **P2** | Per-account usage probe (5h/weekly) → usage chips on each card; lazy + cached + short timeout. |
| **P3** | Per-account Manage/Refresh/connect actions. |
| **P4** | Plug `codex-account` into the same model (Codex N cards). |

## Risks / caveats

- **Usage probing is slow/flaky** — already times out for one account; per-account makes it
  N× worse. Mitigate with lazy + cache + short timeout + `N/A` fallback (P2).
- **Connected-count change** — recompute over provider-accounts; keep providers without a
  source counted as 1 to avoid regressions.
- **Temporary loss of usage/models on the Anthropic card during P1** (uniform cards, usage
  deferred to P2) — accepted; Manage/Refresh retained so it is not a functional regression.
- **No selection coupling here** — picking which account a team/teammate uses stays in the
  team dialogs (`accountBindingByProvider`); this panel is status/visibility only.
```
