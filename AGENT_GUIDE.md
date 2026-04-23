# AGENT_GUIDE

This guide is for AI/code agents and contributors working in `cs_ng_app_client`.

## Mission

- Keep this repo stable as the host shell app.
- Integrate `mfe-wallets` safely through Module Federation.
- Build a robust Angular dApp shell with predictable contracts.

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

When validating or documenting behavior for wallets, treat `../mfe-wallets` as the primary local reference and `git@github.com:vodis/cs_mfe-wallets.git` as the canonical remote source.

## Current Runtime Integration

- Host manifest file: `src/config/mf.manifest.json`
- Production/default wallet entry: `"mfe-wallets": "https://wallets-mfe.craftscript.com/remoteEntry.js"`
- Local dev override can point to: `"mfe-wallets": "http://localhost:5001/remoteEntry.js"`

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
2. Verify host wiring in `src/config/mf.manifest.json`.
3. Cross-check wallet side in `../mfe-wallets` (or remote repository when needed).
4. Sync with latest wallets commit contract changes before editing host docs.
5. Update docs/contracts in this repo when behavior changes.
6. Update dApp communication layer docs (channels/events/payload versions) when Level 2+ changes occur.
7. Validate locally (host + wallet MFE running together).
8. Validate key dApp flow (wallet mount + at least one happy-path interaction).
9. Run quality gates (`pnpm` scripts) before finalizing.

## Validation Minimum

- Lint passes.
- Unit tests pass.
- Host starts and loads wallet remote entry.
- Main wallet flow mounts and renders without console/runtime errors.
- One backend-connected flow validates contract mapping and error handling.

## Non-Goals

- Do not tightly couple host to wallet private implementation details.
- Do not embed undocumented implicit behavior between repositories.

