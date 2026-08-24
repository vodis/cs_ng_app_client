# Repository agent instructions

This guide is for AI/code agents and contributors working in `cs_ng_app_client`.

Before designing, implementing, or reviewing changes, read this file and start
documentation discovery from [`docs/README.md`](docs/README.md). Follow the
relevant canonical guide for the task:

- [`docs/architecture.md`](docs/architecture.md) for ownership boundaries,
  layering, state, and integration contracts
- [`docs/development.md`](docs/development.md) for local setup, implementation
  standards, testing, and change management
- [`docs/branding.md`](docs/branding.md) for user-facing layout, styling,
  typography, and responsive behavior
- [`src/app/mfe-contracts/README.md`](src/app/mfe-contracts/README.md) for the
  host-side wallet MFE contract surface

Keep the root [`README.md`](README.md) concise and onboarding-focused. Put
detailed project guidance in `docs/` and update the documentation index when a
guide is added, renamed, or removed.

## Branch and PR Workflow

- Before starting a new task or creating a new worktree, run `git worktree list`
  and remove stale clean worktrees for this repository. Do not remove a worktree
  with uncommitted or unpushed work.
- Start each code-change task from fresh `develop`: checkout `develop`, pull
  `origin/develop`, then create a new task branch or worktree from that updated
  `develop`.
- Open PRs from the task branch to `develop`.
- Do not open PRs from `develop` directly to `master`/`main`; keep PRs small and
  free of unrelated history.

## Mission

- Keep this repo stable as the host shell app.
- Integrate `mfe-wallets` safely through Module Federation.
- Build a robust Angular dApp shell with predictable contracts.

## UI Branding Reference

When working on UI interface, visual styling, layout, spacing, typography,
responsive behavior, shell chrome, or any user-facing design detail, use
[`docs/branding.md`](docs/branding.md) as the primary reference.

Use it for:

- palette and token decisions
- font and typography sizing
- spacing, padding, and shell measurements
- mobile, laptop, and desktop dimension guidance
- preserving visual consistency across header, sidebar, pages, and panels

## Exchange Page UI Reference

For changes to the default Token Exchange route, read
[`docs/exchange-page.md`](docs/exchange-page.md). It defines the page structure,
API ownership, styling boundaries, responsive expectations, and E2E coverage.

## Target Architecture Baseline

- Architecture style: Angular host shell + domain MFEs + NestJS BFF.
- Host responsibility: shell layout, top-level routing, session bootstrap, telemetry, shared UX policies.
- MFE responsibility (`mfe-wallets`): wallet domain pages, wallet domain workflows, wallet-specific state.
- `mfe-wallets` also owns the browser account-provider instance because that instance performs passkey wallet discovery and wallet signing. The host consumes only the versioned session-facing API in `src/app/mfe-contracts/auth-provider.types.ts`.
- The wallet remote is atomized. Angular loads `./mount` and `./auth-provider`;
  `./providers/privy` remains a wallet-MFE-owned provider atom loaded by the
  MFE only when Privy auth, embedded-wallet creation, or passkey signing needs
  it.
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
- Staging manifest file: `src/config/staging/mf.manifest.json`
- Staging wallet entry: `"mfe-wallets": "https://staging-wallets.craftscript.com/remoteEntry.js"`
- Local dev override can point to: `"mfe-wallets": "http://localhost:5001/remoteEntry.js"`

Production host rules:

- Only load wallet remotes from approved CraftScript wallet origins.
- Do not add arbitrary external wallet bundle URLs to production manifests.
- Treat the wallet remote as executable cross-origin code; keep version/source
  changes reviewable in git and coordinated with `cs_mfe-wallets`.

Any contract change in wallets (routes, exposed modules, events, required inputs) must be mirrored in this host.

The canonical auth-provider runtime contract is open in
`cs_mfe-wallets/src/contracts/auth-provider-contract.ts`. The MFE loads backend
public auth configuration and coordinates provider session registration.
Angular supplies only its generic API base URL and consumes normalized session
and wallet contracts. Never add provider-specific SDKs, configuration, DTOs,
endpoints, or globals to the host.

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

## Type Safety Rule (Mandatory)

- Do not add `any` in new or modified code.
- Do not use type-cast escapes to bypass typing (`as any`, `as unknown as T`, `<any>...`).
- Fix typing at the source (interfaces, unions, guards, and precise generics).
- If legacy code already contains unavoidable casts, do not propagate the pattern; keep changes strictly typed.

## Non-Goals

- Do not tightly couple host to wallet private implementation details.
- Do not embed undocumented implicit behavior between repositories.
