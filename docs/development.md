# Development guide

This document describes daily development standards for `cs_ng_app_client` and its integration with `mfe-wallets`.

This host is the Angular shell for a dApp-style product (DEX-like interaction patterns), and should evolve with explicit boundaries to `mfe-wallets` and backend APIs.

## Repositories and Sources

- Host app (this repo): `cs_ng_app_client`
- Wallet MFE local source: `../mfe-wallets`
- Wallet MFE remote git: `git@github.com:vodis/cs_mfe-wallets.git`
- Backend local source: `../cs_nestjs_backend`
- Backend remote repository: `https://github.com/vodis/cs_nestjs_backend`

## Target Architecture (from scratch)

- Frontend shape: Angular host shell with domain-oriented features and optional MFEs.
- Backend shape: NestJS BFF exposing typed APIs for market/quote/execution workflows.
- Ownership split:
  - Host: app frame, top routing, shared UX conventions, global session/network state.
  - `mfe-wallets`: wallet domain UI + wallet domain workflows.
  - NestJS: orchestration and integration boundaries, not UI concerns.
- Cross-boundary rule: every interaction is a documented contract (URL/module, typed payloads, versioned events).

## Local Setup

1. Install dependencies with `pnpm install`.
2. Copy `src/environments/environment.local.example.ts` to
   `src/environments/environment.local.ts` (gitignored) and adjust `apiUrl` /
   `mfeWalletsRemoteUrl` if needed.
3. Run host app with `pnpm start`.
4. Run wallets MFE from local source `../mfe-wallets` (or matching branch from `git@github.com:vodis/cs_mfe-wallets.git`).
5. Verify `mfeWalletsRemoteUrl` in the active environment file:
   - Local serve (`environment.local.ts`): typically `http://localhost:5002/remoteEntry.js`
   - Staging (`environment.staging.ts`): `https://staging-wallets.craftscript.com/remoteEntry.js`
   - Production (`environment.production.ts`): `https://wallets.craftscript.com/remoteEntry.js`

Production wallet remote policy:

- Keep production wallet remote URLs pinned to known CraftScript origins.
- Do not load arbitrary external wallet bundle URLs in production.
- Coordinate remote URL, mount contract, and deployment changes with
  `cs_mfe-wallets` and the orchestrator nginx/CORS policy.

## Branch and PR Hygiene

- Start task branches and task worktrees from a freshly pulled `develop`.
- Before creating a new worktree, remove stale clean worktrees for this
  repository; preserve any worktree with uncommitted or unpushed work.
- Open PRs back to `develop`.
- Keep PRs focused to one concern (wiring, contract, UI, refactor, test).
- If host and wallets both change, open coordinated PRs and cross-link them.
- Document compatibility notes when one PR depends on the other.

## Auth navigation

- Login and register send wallet-less sessions to `/profile`, not a wallet
  setup interstitial.
- Users who already have a linked wallet still continue to `returnUrl`.
- Keep wallet, passkey, and swap onboarding on `/profile` so first-time
  users can enter the app shell immediately.
- Keep profile integrations behind `ProfileFacade`; do not inject auth, wallet
  gateway, or router services directly into `ProfileComponent`.
- Supply activity through `ProfileActivitySource` so the activity panel and
  onboarding progress cannot diverge.

## Architecture Rules (best practices)

- Explicit boundaries:
  - Host owns shell, routing frame, shared app concerns.
  - Wallet MFE owns wallet domain UI and wallet domain logic.
- Domain-driven Angular:
  - Organize by domain/feature boundaries, not by generic technical folders only.
  - Keep feature state near feature modules; keep global app state intentionally small.
- UI to data flow:
  - Components -> facade/application service -> domain API client.
  - Avoid direct HTTP/integration calls from presentation components.
- Layering:
  - Presentation layer for rendering and user interaction only.
  - Application layer for orchestration and flow decisions.
  - Infrastructure layer for transport and third-party integration.
- Stable contracts:
  - Prefer typed interfaces and versioned events for host-MFE communication.
  - Avoid importing private internals across repo boundaries.
- Defensive integration:
  - Handle remote load failure, timeout, and invalid payload cases.
  - Show meaningful fallback UI instead of blank screen.
- Incremental evolution:
  - Use additive changes first.
  - Mark deprecated contracts before removing them.

## NestJS Backend Contract (for Angular Host)

- Backend should be consumed as typed BFF-style APIs.
- Keep quote/market/execution payloads versioned and explicit.
- Standardize error handling at host level (code, message, retryability, context).
- Require request correlation ID support for tracing and debugging.

### API contract checklist

- Version routes (`/v1/...`) and evolve additively.
- Validate response schema at host boundary before mapping to UI models.
- Keep host-owned mappers between API DTOs and UI/domain models.
- Do not pass backend DTOs directly into presentational components.

## Communication Contract with `mfe-wallets`

### Level 0 - Technical link

- Remote entry location and exposed module names must be documented.
- Host and wallets should align on Angular/runtime compatibility.

### Level 1 - Routing/mount

- Define entry route(s), mount lifecycle, and ownership of navigation state.
- Avoid hidden assumptions about browser history behavior.

### Level 2 - Data/API

- Define all required input props/context and expected output callbacks/events.
- Validate payloads at boundary points.
- Keep backend-derived models mapped through host-owned interfaces.

### Level 3 - Domain events

- Use stable, namespaced event names.
- Include payload schema and version notes in docs/changelog.

### Level 4 - Operational behavior

- Align on error semantics, telemetry fields, feature flags, and auth/session expectations.
- If one side changes behavior, update both docs and tests.

## dApp Communication Layer (implementation baseline)

Define and maintain these communication channels:

- Host <-> MFE:
  - mount contract, inputs/outputs, versioned events
- Host <-> NestJS BFF:
  - typed request/response DTOs and stable error envelope
- Host internal normalization:
  - map MFE/backend payloads to host-owned domain models before UI rendering

### Standard event contract (Host <-> MFE)

- Event names:
  - `wallet.connected`
  - `wallet.disconnected`
  - `wallet.accountChanged`
  - `wallet.chainChanged`
  - `wallet.txSigned`
  - `wallet.error`
- Event payload envelope:
  - `eventVersion`
  - `traceId`
  - `timestamp`
  - `source`
  - `payload`

### Standard API contract (Host <-> BFF)

- Route versioning required (`/v1/...`).
- Error envelope required (`code`, `message`, `retryable`, `details`).
- Correlation ID propagation required for all critical dApp flows.
- Host must map DTOs to domain models through dedicated mappers.

### Change management

- Any Level 2+ contract change requires:
  - docs update in host and MFE
  - payload/schema version note
  - integration smoke validation on both sides

## Testing Strategy

- Minimum before merge:
  - `pnpm run lint`
  - `pnpm exec ng test --no-watch --no-progress --browsers=ChromeHeadlessNoSandbox`
  - `pnpm run build-prod`
- Integration smoke:
  - Start host and wallet MFE together.
  - Validate wallet route load, one happy-path dApp action, and fallback behavior.
  - Validate one backend-connected flow with mocked or real dev API contract.

## Suggested Angular Structure

Use this structure as the baseline for new work:

- `src/app/core` - app bootstrap, interceptors, global providers, config loaders.
- `src/app/shared` - reusable stateless UI and utilities.
- `src/app/domains/<domain>/ui` - domain components and pages.
- `src/app/domains/<domain>/application` - facades and use-cases.
- `src/app/domains/<domain>/data-access` - API clients, adapters, mappers.
- `src/app/domains/<domain>/models` - domain types/interfaces.
- `src/app/mfe-contracts` - host to MFE contracts, event names, payload schemas.

## CI Alignment

CI already validates lint, tests, and production build (`.github/workflows/build-dev.yml`).
Keep local checks aligned with CI commands to reduce pipeline surprises.

Merges to `develop` also publish `ghcr.io/vodis/cs_ng_app_client:staging` and
the matching `:staging-metadata` artifact. That image uses Angular's `staging`
configuration and sends API calls through the staging app's same-origin
`/api/` gateway. It is deployed as `staging-cs-ng-app-client` at
`https://staging-app.craftscript.com`.

Until `staging-wallets.craftscript.com` is registered, staging continues to
load the approved production wallet remote from `wallets.craftscript.com`, but
passes `environment: staging` and the staging API base URL through the host/MFE
contract.

## Documentation Requirements

Update this guide and [`AGENTS.md`](../AGENTS.md) whenever one of the following changes:

- Module Federation remote URL/module names.
- Host/MFE communication contract.
- Wallet integration lifecycle or routing behavior.
- Required local run/test commands.

## Authentication Routes and UX

Host auth routes live under `src/app/pages/auth/`.

| Route              | Access      | Notes                                                              |
| ------------------ | ----------- | ------------------------------------------------------------------ |
| `/login`           | Public      | Passkey, Google, Apple, Telegram always shown; email code fallback |
| `/register`        | Public      | Account creation only; wallet setup is separate                    |
| `/profile`         | `AuthGuard` | Balance hero, onboarding, activity, sessions, account footer       |
| `/generate-wallet` | `AuthGuard` | Legacy redirect to `/profile`                                      |

### Login expectations

- `/login` always renders Passkey, Google, Apple, and Telegram buttons.
- Passkey remains visible even when the account has not enabled passkey yet.
- When passkey sign-in fails because passkey is not enabled in profile, show a
  UX message that tells the user to sign in with Google, Apple, or Telegram
  first and enable passkey from profile.
- Telegram may remain a staged provider; keep the button visible and show a
  coming-soon/info state until the provider is wired.

### Session redirect policy

- Missing or non-renewable sessions redirect to `/login?returnUrl=<safe-path>`.
- `AuthGuard` waits for auth-provider readiness before attempting refresh.
- Logout navigates to `/login`.

### Wallet onboarding split

- Login/register without linked wallets routes to `/profile`, not a blocking
  wallet interstitial.
- `/profile` shows a `$0.00` balance hero plus an Onboarding portfolio card
  for wallet, passkey, and five swaps.
- Generate wallet uses the host auth-session bridge; connecting an existing
  wallet still opens the wallets MFE modal. The swap step routes to
  Exchange.
- Legacy `/generate-wallet` links redirect to `/profile`.

### Local validation for auth changes

1. Start host and wallets MFE together.
2. Verify `/login` social buttons and passkey-not-enabled messaging.
3. Verify protected-route redirect to `/login` without a session.
4. Verify register/login without wallets routes to `/profile` with a `$0.00`
   balance hero.
5. Verify the Onboarding portfolio Set up wallet CTA opens the wallets MFE
   modal, and Generate wallet creates an embedded wallet.
