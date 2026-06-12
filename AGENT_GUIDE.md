# AGENT_GUIDE

This guide is for AI/code agents and contributors working in `cs_ng_app_client`.

## Branch and PR Workflow

- Start each code-change task from fresh `develop`: checkout `develop`, pull `origin/develop`, then create a new task branch.
- Open PRs from the task branch to the repository default release branch (`master` today; `main` if the repo is renamed later).
- Do not open PRs from `develop` directly to `master`/`main`; keep PRs small and free of unrelated `develop` history.

## Mission

- Keep this repo stable as the host shell app.
- Integrate `mfe-wallets` safely through Module Federation.
- Build a robust Angular dApp shell with predictable contracts.

## Exchange Page UI Reference

The default route (`/`) renders the **Token Exchange** screen inside the host shell. Treat the layout below as the product baseline when changing home-page UI or styles.

### Shell frame

```text
+------------------------------------------------------------------+
| [Logo]                                    [CONNECT WALLET]       |
+----------+-------------------------------------------------------+
| Sidebar  | Main content (HomeComponent / `.exchange-page`)       |
|          |                                                       |
| Inform.  |  TOKEN EXCHANGE intro banner                          |
|  Board   |  +------------------+  +---------------------------+  |
| Finance  |  | Swap Tokens      |  | Market Overview           |  |
|  Farm    |  |                  |  |                           |  |
| Dev Act. |  +------------------+  +---------------------------+  |
| Proposals|  | Recent Activity (full-width table)                |  |
+----------+-------------------------------------------------------+
```

| Shell area             | Route                      | Primary files                 |
| ---------------------- | -------------------------- | ----------------------------- |
| Header (logo + wallet) | global                     | `src/app/components/header/`  |
| Sidebar navigation     | `/`, `/farm`, `/proposals` | `src/app/components/sidebar/` |
| App frame              | global                     | `src/app/components/layout/`  |
| Token Exchange page    | `/`                        | `src/app/pages/home/`         |

Sidebar groups:

- **Informations** → Board (`/`)
- **Finance** → Farm (`/farm`)
- **Dev Activity** → Proposals (`/proposals`)

Wallet connect lives in the header (`app-wallet-bar`, wallets MFE). Swap panel submit also requires a connected wallet.

### Page sections

#### 1. Intro banner (`.intro`)

- Title: `Token Exchange`
- Subtitle: `Best routes. Best price. Powered by CraftScript.`

#### 2. Swap Tokens (`.panel.swapPanel`)

Left column (`gridTop` is `42% / 58%` on desktop).

| Block        | Markup / classes   | Behavior                                                    |
| ------------ | ------------------ | ----------------------------------------------------------- |
| From row     | `.swapRow.first`   | Token selector, balance, amount input, USD estimate         |
| Flip control | `.swapCircle`      | Swaps from/to tokens and reloads market comparison          |
| To row       | `.swapRow`         | Token selector, balance, quoted/output amount, USD estimate |
| Details grid | `.stats` / `.stat` | Rate, Price Impact, Slippage, Network Fee                   |
| Primary CTA  | `.connectMain`     | Submits quote (`submitQuote()`); label follows wallet state |

Token pickers open `app-side-modal` with `app-token-select-panel`. Amount editing, paste guards, and decimal validation stay in `HomeComponent`.

#### 3. Market Overview (`.panel.marketPanel`)

Right column.

| Block          | Markup / classes                      | Behavior                                                                                      |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Header         | `.marketHead`                         | Title + tabs (Price / Volume / Liquidity) and timeframe buttons                               |
| Timeframes     | `.range`                              | `1H`, `1D`, `1W`, `1M` (active state switches comparison window)                              |
| Summary column | `.marketBody`, `.marketSummary`       | Narrow left column (`~104px`) for pair, price, and 24h change                                 |
| Pair           | `.pair`                               | Base/quote token icons and symbol pair                                                        |
| Price          | `.price`, `.change`                   | Quote token price and 24h change from comparison API                                          |
| Chart          | `.chart`                              | SVG comparison chart in the right grid column (`1fr`)                                         |
| Footer         | `.marketFooter`, `.note`, `.advanced` | Hint (`margin-top: 16px`) + advanced link (`margin-top: 12px`) in normal flow below the chart |

Market data loads from `GET ${environment.apiUrl}/api/v1/markets/comparison`.

#### 4. Recent Activity (`.panel.activity`)

Full-width table below the top grid.

| Column  | Content                                       |
| ------- | --------------------------------------------- |
| Time    | Trade timestamp                               |
| Pair    | Token icons with arrow (`.pairCell`, `.mini`) |
| Amount  | Sold amount                                   |
| You Get | Received amount                               |
| Status  | Completion state (`.status`, `.external`)     |

Row data is currently defined in `HomeComponent.recentActivity` (host-owned demo content until backend history is wired).

### Styling contract

Exchange page styles are scoped under `.exchange-page` in `src/styles/exchange-page.scss` (imported from `src/styles.scss`).

| Token                  | Value                    | Usage                             |
| ---------------------- | ------------------------ | --------------------------------- |
| `--exchange-orange`    | `#ff6900`                | Labels, active tabs, CTAs, links  |
| `--exchange-green`     | `#00d084`                | Positive change, completed status |
| `--exchange-line`      | `#2a3437`                | Panel borders                     |
| `--exchange-line-soft` | `#20292c`                | Row dividers                      |
| Page background        | `#111719`                | Exchange content area             |
| Panel background       | `rgba(12, 18, 20, 0.55)` | Cards with inset highlight        |

Typography and spacing targets:

- Panel padding: `24px` (swap), `24px 28px` (market)
- Swap row height: `112px`; stats row height: `70px`
- Market panel height: `486px` on desktop (auto on `<= 1100px`)
- Market body grid: `104px / 1fr` — keep the price column compact so the chart gets most of the width
- Amount fields use `Aeonik Fono` via `.amount`

Keep new exchange UI inside `.exchange-page` selectors. Avoid leaking exchange-specific rules into global shell styles.

### Exchange APIs used by Home

| Action                  | Endpoint                         | Owner      |
| ----------------------- | -------------------------------- | ---------- |
| Dry quote               | `POST /api/v1/quotes/one-click`  | NestJS BFF |
| Market comparison chart | `GET /api/v1/markets/comparison` | NestJS BFF |

Client token metadata in `HomeComponent.exchangeTokens` is display/bootstrap only. Authoritative tradability and quote validation remain on the backend.

### UI change checklist (Exchange page)

1. Update `home.component.html` structure only when the product layout actually changes.
2. Mirror class renames in `src/styles/exchange-page.scss`.
3. Preserve wallet gating, token modal flow, quote submission, and comparison reload on token swap.
4. Verify desktop grid (`42% / 58%`) and mobile single-column breakpoint (`<= 1100px`).
5. Run lint/tests/build before finishing.

## Target Architecture Baseline

- Architecture style: Angular host shell + domain MFEs + NestJS BFF.
- Host responsibility: shell layout, top-level routing, session bootstrap, telemetry, shared UX policies.
- MFE responsibility (`mfe-wallets`): wallet domain pages, wallet domain workflows, wallet-specific state.
- Backend responsibility (NestJS): typed BFF APIs, aggregation/orchestration, normalized error model, observability boundaries.
- Key rule: communication happens only through documented contracts (route/mount, typed data, versioned events).

## Repositories and Sources

- Host app (this repo): `cs_ng_app_client`
- Wallet MFE local source: `../mfe-wallets`
- Wallet MFE remote git: `git@github.com:vodis/cs_mfe-wallets.git`
- Backend local source: `../cs_nestjs_backend`
- Backend remote repository: `https://github.com/vodis/cs_nestjs_backend`

When validating or documenting behavior for wallets, treat `../mfe-wallets` as the primary local reference and `git@github.com:vodis/cs_mfe-wallets.git` as the canonical remote source.

When validating or documenting backend-dependent host behavior, treat `../cs_nestjs_backend` as the primary local reference and `https://github.com/vodis/cs_nestjs_backend` as the canonical remote source.

## Current Runtime Integration

- Host manifest file: `src/config/mf.manifest.json`
- Production/default wallet entry: `"mfe-wallets": "https://wallets.craftscript.com/remoteEntry.js"`
- Local dev override can point to: `"mfe-wallets": "http://localhost:5001/remoteEntry.js"`

Production host rules:

- Only load wallet remotes from approved CraftScript wallet origins.
- Do not add arbitrary external wallet bundle URLs to production manifests.
- Treat the wallet remote as executable cross-origin code; keep version/source
  changes reviewable in git and coordinated with `cs_mfe-wallets`.

Any contract change in wallets (routes, exposed modules, events, required inputs) must be mirrored in this host.

## Angular dApp Architecture Guardrails

- Domain-driven structure over technical-layer folders.
- Host shell owns app frame, global navigation, session bootstrap, and cross-cutting concerns.
- MFE owns wallet domain screens and wallet-specific application logic.
- Keep global state minimal (session/network/preferences/feature flags); keep domain state near feature boundaries.
- Components should consume facades/services, not call transport/integration APIs directly.

### Required Host Layering

- Presentation layer: standalone components and templates only.
- Application layer: facades/use-cases that orchestrate UI behavior.
- Domain layer: domain models and pure business rules owned by host.
- Infrastructure layer: API clients, adapters, and integration gateways.

Enforce flow direction: `component -> facade/use-case -> domain service -> gateway/api`.

## Backend Integration Model (NestJS BFF)

- Treat backend as a BFF boundary for this host, not as a UI detail leak.
- Use typed request/response contracts for quote/market/execution style APIs.
- Require consistent error shape and traceable request IDs.
- Never couple frontend behavior to backend private implementation details.

### Exchange/Spot Trading Asset Ownership

- The canonical supported asset/token registry belongs in the NestJS BFF, not in this Angular host and not in `mfe-wallets`.
- Backend owns token identifiers, decimals, chain/network mappings, tradable/depositable/withdrawable flags, private RPC balance reads, quote/execution validation, and final rejection of unsupported assets.
- This host consumes versioned backend APIs such as `/v1/assets`, `/v1/balances`, `/v1/markets`, `/v1/quote`, and `/v1/execute`, then maps DTOs into host-owned UI/domain models.
- Client-side token maps may be used only for non-authoritative display fallbacks, skeleton UI, search hints, or cached rendering. They must not decide whether a balance, quote, or trade is valid.
- When community/public token lists are introduced later, treat them as backend-ingested inputs that require server-side validation and allowlisting before they affect product behavior.

### Backend Contract Minimum

- Response envelope: deterministic shape for `data`, `error`, and `meta`.
- Error schema: `code`, `message`, `retryable`, `details`.
- Traceability: request correlation ID propagated from host to backend and logs.
- Versioning: additive contract evolution first, deprecation window before removals.

## Communication Levels with MFE

Use these levels to keep host/MFE communication explicit.

1. Level 0 - Build and runtime wiring
   - Module Federation host/remote registration.
   - Remote entry URL, exposed module names, bootstrap compatibility.
2. Level 1 - Navigation and mount contract
   - Route handoff, mount point ownership, and lifecycle expectations.
   - Host controls shell layout; MFE controls its internal screen flow.
3. Level 2 - Data/API contract
   - Typed inputs/outputs for wallet domain data.
   - No direct cross-repo internals access; communicate through explicit interfaces.
   - If data is backend-originated, contract remains explicit at host boundary.
4. Level 3 - Events and state sync
   - Cross-boundary events are versioned and documented.
   - Keep event names stable; deprecate in phases, do not break silently.
5. Level 4 - UX/system concerns
   - Error format, loading behavior, auth/session assumptions, telemetry, feature flags.
   - Shared behavior should be centralized in host-level conventions.

Do not skip levels when introducing a change. A Level 3 event change usually implies Level 2 documentation updates and test updates at Level 0/1.

## dApp Communication Layer (Host <-> MFE <-> Backend)

Use three explicit channels:

- Channel A: Host <-> MFE runtime contract
  - Mount/unmount lifecycle
  - typed input props and output callbacks
  - versioned domain events
- Channel B: Host <-> NestJS BFF API contract
  - typed DTO requests/responses
  - stable error envelope and correlation IDs
- Channel C: Host local domain state contract
  - host-owned normalized models and mappers
  - no direct MFE model leakage into global host state

Canonical event naming:

- `wallet.connected`
- `wallet.disconnected`
- `wallet.accountChanged`
- `wallet.chainChanged`
- `wallet.txSigned`
- `wallet.error`

Event payload envelope minimum:

- `eventVersion`
- `traceId`
- `timestamp`
- `source`
- `payload`

Compatibility policy:

- Additive first, then deprecate, then remove.
- If event payload changes, bump `eventVersion`.
- Breaking event/API changes require host and MFE coordinated release notes.

## Architecture Best Practices

- Boundary first: keep wallet business logic in wallets MFE, shell concerns in host.
- Contract first: define and update contracts before implementation changes.
- Version first: apply additive, backward-compatible contract changes where possible.
- Backward compatibility: prefer additive changes; remove only after migration window.
- Single source of truth: one owner per contract (host or wallets), with explicit docs.
- Fail safe: if remote fails to load, host should degrade gracefully and show actionable error UI.
- Observable by default: emit actionable logs/telemetry for remote load, contract failures, and API failures.

## Change Workflow (Agent Checklist)

1. Identify touched communication level(s).
2. For home/exchange UI work, confirm changes still match **Exchange Page UI Reference** above.
3. Verify host wiring in `src/config/mf.manifest.json`.
4. Cross-check wallet side in `../mfe-wallets` (or remote repository when needed).
5. Sync with latest wallets commit contract changes before editing host docs.
6. Update docs/contracts in this repo when behavior changes.
7. Update dApp communication layer docs (channels/events/payload versions) when Level 2+ changes occur.
8. Validate locally (host + wallet MFE running together).
9. Validate key dApp flow (wallet mount + at least one happy-path interaction).
10. Run quality gates (`pnpm` scripts) before finalizing.

## Validation Minimum

- Lint passes.
- Unit tests pass.
- Host starts and loads wallet remote entry.
- Main wallet flow mounts and renders without console/runtime errors.
- One backend-connected flow validates contract mapping and error handling.

## Non-Goals

- Do not tightly couple host to wallet private implementation details.
- Do not embed undocumented implicit behavior between repositories.
