# Architecture guide

This guide defines the target architecture for `cs_ng_app_client` as an Angular dApp host shell integrated with `mfe-wallets` and NestJS backend APIs.

## 1. Goals

- Build a deterministic, auditable, and scalable frontend architecture.
- Keep boundaries explicit between host, MFE, and backend.
- Standardize execution flows for complex financial workflows.
- Reduce regressions by enforcing clear ownership and contracts.

## 2. System Context

- Host app (this repo): `cs_ng_app_client`
- Wallet MFE local source: `../mfe-wallets`
- Wallet MFE remote git: `git@github.com:vodis/cs_mfe-wallets.git`
- Wallet remote URL: `environment.mfeWalletsRemoteUrl` (bootstrapped in `src/main.ts`)

Remote entry expectations:

- Production (`environment.production.ts`): `https://wallets.craftscript.com/remoteEntry.js`
- Staging (`environment.staging.ts`): `https://staging-wallets.craftscript.com/remoteEntry.js`
- Local default (`environment.ts` / `environment.local.ts`): `http://localhost:5002/remoteEntry.js`

Production remote entries must come from approved CraftScript wallet origins
only. The host should not load arbitrary external wallet bundles in the
production-ready state.

## 3. Ownership Boundaries

- Host owns:
  - app shell layout and top-level routing
  - global session/network/preferences
  - cross-cutting concerns (logging, telemetry, error policy)
  - host-side integration contracts with MFE and backend
- `mfe-wallets` owns:
  - wallet domain pages and internal workflows
  - wallet-specific domain state and UI behavior
  - browser account-provider lifecycle and provider wallet operations
- NestJS backend owns:
  - BFF/API orchestration and aggregation
  - integration with external providers
  - normalized API contract and observability outputs

Rule: no hidden coupling across boundaries. Only documented contracts are allowed.

The wallet MFE loads the authoritative NestJS public auth configuration and
owns provider session coordination. Angular starts the federated provider
without blocking public shell routes, consumes only normalized sessions, and
auth guards await a terminal provider state before restoring a protected
session. The canonical provider contract lives in the open `cs_mfe-wallets`
repository; Angular keeps a structural, runtime-version-checked consumer copy.

### Provider ownership decision

The cross-repository decision and deployment order are canonical in
[`cs_orchestrator/docs/architecture/privy-wallet-ownership.md`](https://github.com/vodis/cs_orchestrator/blob/main/docs/architecture/privy-wallet-ownership.md).
The browser contract is canonical in
[`cs_mfe-wallets/src/contracts/auth-provider-contract.ts`](https://github.com/vodis/cs_mfe-wallets/blob/main/src/contracts/auth-provider-contract.ts).

`PrivyProvider -> PrivyConnector -> WalletIdentity -> PrivySessionCoordinator -> WalletGateway -> generic host event`

Angular begins only at the final boundary. It:

- mounts `./auth-provider` with the generic backend `apiBaseUrl`;
- consumes versioned provider-neutral snapshots and normalized sessions;
- may use generic bearer tokens for backend API access;
- may call provider-neutral account actions such as `linkPasskey()` and render
  normalized session fields such as `passkeyEnabled`;
- must not import the Privy SDK, parse Privy configuration, register wallets,
  interpret Privy linked accounts, store passkey credential IDs, or expose
  Privy-specific fields in UI/domain models.

Any change that would move those responsibilities into Angular is an
architecture change, not a local implementation shortcut, and requires updates
to the MFE contract, backend contract, and the canonical orchestrator decision.

## 4. Angular Layering Model

Use explicit layers and one-way flow:

- Presentation layer:
  - standalone components, templates, user interactions
  - no direct transport calls
- Application layer:
  - facades and workflow orchestrators
  - coordinates async steps, retries, and transitions
- Domain layer:
  - domain models and pure business logic
- Infrastructure layer:
  - API clients, adapters, mappers, external integrations

Flow direction:

- `component -> facade/workflow -> domain service -> gateway/api`

## 5. Execution Flows (Banking-grade approach)

Complex flows (swap, transfer, payout, order execution) must be represented as explicit workflow services.

Recommended flow states:

- `idle`
- `validating`
- `requestingQuote`
- `awaitingUserSignature`
- `submittingTransaction`
- `confirming`
- `completed`
- `failed`

Workflow requirements:

- Each transition is explicit and logged.
- Each failure state maps to a known recovery action.
- Retries use policy-based limits (no infinite loops).
- UI consumes state from facade/workflow; UI does not orchestrate flow.

## 6. State Management Strategy

Use split-by-scope state, not one giant global store.

- Global state (small and durable):
  - auth/session
  - network/account context
  - feature flags and user preferences
- Domain state (feature-local):
  - market/quote/transaction form state
  - portfolio and filter state
- Ephemeral UI state:
  - dialog visibility
  - temporary view selections

Recommended primitives:

- Angular Signals for local/domain state
- RxJS for async streams and integration boundaries
- Introduce heavy global store only if cross-domain complexity demands it

## 7. Subscription and Side-effect Policy

- Prefer `async` pipe and `toSignal()` in components.
- Use `takeUntilDestroyed()` or `DestroyRef` for service/facade subscriptions.
- Do not leave unmanaged subscriptions.
- Keep side-effects in facades/workflows, not in presentational components.
- Ban "naked subscribe" in components except one-shot UI actions with clear lifecycle.

## 8. Storage Policy

Storage must be tiered and explicit by data class.

- In-memory:
  - runtime flow state and sensitive transient data
- `sessionStorage`:
  - tab-scoped transient, non-sensitive flow context
- `localStorage`:
  - non-sensitive preferences only
- IndexedDB:
  - larger non-sensitive caches (token metadata, market snapshots)

Never store:

- private keys
- sensitive credentials
- secrets or signed payloads beyond safe transient usage

Version all storage keys and support migration:

- Example: `app:v1:preferences`, `app:v1:market-cache`

## 9. Logging, Telemetry, and Audit

All critical flows require structured logs.

Standard fields:

- `traceId`
- `sessionId`
- `flowName`
- `step`
- `result`
- `durationMs`
- `errorCode`
- `retryable`

Requirements:

- Propagate correlation IDs to backend where supported.
- Log major workflow transitions and terminal failures.
- Keep logs actionable, minimal, and privacy-safe.

## 10. API Contract Rules (NestJS BFF)

- Version APIs from day one (`/v1/...`).
- Use typed DTOs and host-owned mapping to domain models.
- Standardize error shape:
  - `code`, `message`, `retryable`, `details`
- Never pass raw backend DTOs directly to UI components.
- Validate boundary responses before domain mapping.

## 11. Host <-> MFE Contract Rules

Contract levels:

- Level 0: build/runtime wiring (remote URL, exposed modules)
- Level 1: mount/navigation contract
- Level 2: data contract (typed inputs/outputs)
- Level 3: event contract (versioned event names and payload schema)
- Level 4: operational behavior (errors, loading, auth/session assumptions)

Contract change policy:

- Prefer additive changes.
- Mark deprecations before removal.
- Update host and MFE docs together for Level 2+ changes.

## 11.1 dApp Communication Layer

The communication layer is a protocol, not an implementation detail.

Channels:

- Runtime channel (Host <-> MFE)
  - mount lifecycle, typed inputs/outputs, versioned events
- API channel (Host <-> NestJS BFF)
  - request/response DTOs, standardized errors, correlation IDs
- State normalization channel (Host internal)
  - adapters map external payloads to host-owned domain models

Required runtime events (wallet baseline):

- `wallet.connected`
- `wallet.disconnected`
- `wallet.accountChanged`
- `wallet.chainChanged`
- `wallet.txSigned`
- `wallet.error`

Required event payload envelope:

- `eventVersion`
- `traceId`
- `timestamp`
- `source`
- `payload`

Protocol governance:

- Event and API changes are additive by default.
- Breaking payload changes require version bump and migration note.
- Host and MFE release notes must reference matching contract updates.

## 12. Suggested Frontend Structure

Baseline structure for this repository:

- `src/app/core`
  - app bootstrap, interceptors, providers, global configuration
- `src/app/shared`
  - reusable stateless UI and utility helpers
- `src/app/domains/<domain>/ui`
  - pages and domain components
- `src/app/domains/<domain>/application`
  - facades, workflows, use-cases
- `src/app/domains/<domain>/data-access`
  - API clients, adapters, mappers
- `src/app/domains/<domain>/models`
  - domain types and interfaces
- `src/app/mfe-contracts`
  - host/MFE event names, payload contracts, boundary types

## 13. Minimum Quality Gates

Before merge:

- `pnpm run lint`
- `pnpm exec ng test --no-watch --no-progress --browsers=ChromeHeadlessNoSandbox`
- `pnpm run build-prod`

Integration checks:

- Host starts and resolves configured wallet remote entry.
- Wallet mount flow works on happy path.
- At least one backend-connected flow validates mapping + error handling.
- Fallback UI appears for remote/API failures.

## 14. Decision Checklist (for new features)

For every new feature, answer:

1. Which layer owns this behavior?
2. Is this host logic or MFE logic?
3. What contract is introduced/changed?
4. Where is state stored and why?
5. What failure modes exist and how are they recovered?
6. What logs/telemetry are required for supportability?
7. Which communication channel(s) are touched and what version changes are needed?

If these answers are not explicit, implementation should not start.

## 15. Authentication and Session Flow

The host owns top-level auth routing and session restoration. The wallet MFE owns
provider login, passkey linking, and wallet modal workflows.

### Public routes

| Route       | Purpose                |
| ----------- | ---------------------- |
| `/login`    | Returning-user sign in |
| `/register` | New account creation   |

Both routes render outside the main shell (no header/sidebar). Route prefixes are
owned in `src/app/core/routing/auth-shell.routes.ts` and applied by
`LayoutComponent` via `*ngIf` — do not duplicate them in `index.html`.

### Protected routes

| Route              | Guard       | Purpose                                           |
| ------------------ | ----------- | ------------------------------------------------- |
| `/profile`         | `AuthGuard` | Account settings, passkey enablement, wallet list |
| `/generate-wallet` | `AuthGuard` | First-time wallet onboarding after auth           |

### Login methods on `/login`

The login page always offers these social entry points:

- Passkey
- Google
- Apple
- Telegram

Email code login remains available as a fallback form.

Passkey UX rule:

- Passkey is always visible on `/login`.
- If the user has not enabled passkey in profile yet, the host maps provider
  errors to a friendly message that directs them to sign in with Google, Apple,
  or Telegram first, then enable passkey from `/profile`.

### Session policy

`AuthGuard` behavior:

1. Allow navigation when `AuthSessionService.session` is already populated.
2. Otherwise wait for the auth provider to reach a terminal state.
3. Attempt `AuthSessionService.refresh()` when the provider is `ready`.
4. Redirect to `/login?returnUrl=<safe-path>` when there is no valid session and
   refresh cannot restore one.

Logout clears host session state and navigates to `/login`.

### Post-auth wallet onboarding

Account creation or login without linked wallets does not enter the dApp
immediately. The host routes to `/generate-wallet?returnUrl=<safe-path>`.

`/generate-wallet` owns first-time wallet setup:

- Connect existing wallet (opens wallets MFE modal)
- Generate embedded wallet (host bridge into wallets MFE)
- Continue after wallet is connected

`/profile` does not duplicate generate-wallet UI. It renders a Connect wallet
button that opens the wallets MFE modal, which already contains generate/link
flows for returning users.
