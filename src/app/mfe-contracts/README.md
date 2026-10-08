# MFE Contracts

Cross-repository provider ownership is documented in
[`cs_orchestrator/docs/architecture/privy-wallet-ownership.md`](https://github.com/vodis/cs_orchestrator/blob/main/docs/architecture/privy-wallet-ownership.md).
This directory is a provider-neutral consumer copy; the canonical browser
contract is `cs_mfe-wallets/src/contracts/auth-provider-contract.ts`.

This document defines implementation-level contracts for host `<->` `mfe-wallets` communication and host `<->` NestJS BFF interactions.

Use this as the source of truth for runtime communication in the Angular app.

## Scope

- Host app: `cs_ng_app_client`
- Wallet MFE source: `../mfe-wallets`
- Wallet MFE remote: `git@github.com:vodis/cs_mfe-wallets.git`

## Account provider contract

The canonical, open runtime contract is
`cs_mfe-wallets/src/contracts/auth-provider-contract.ts`. This host keeps only
the structural consumer copy in `auth-provider.types.ts` and validates contract
version `2.3.0` before mounting `mfe-wallets/auth-provider`.

The wallet remote exposes atomized entrypoints:

- `./mount` for the generic wallet UI/runtime.
- `./auth-provider` for the thin auth-provider bootstrap consumed by Angular.
- `./providers/privy` for the Privy implementation atom owned and loaded by
  `cs_mfe-wallets`.

Angular should continue to load only `./mount` and `./auth-provider`. It must
not load `./providers/privy` directly unless provider ownership is intentionally
moved into the host by a future contract change.

Passkey enablement is consumed through the provider-neutral `linkPasskey()`
contract method and the normalized `passkeyEnabled` user field. Angular must
not inspect provider linked-account payloads or passkey credential IDs.

The NestJS `GET /api/v1/public/auth-config` response is the single source of
truth for enabled login methods and public provider configuration. `mfe-wallets`
loads that configuration, owns browser provider lifecycle, registers normalized
sessions and embedded wallets with the backend, and exposes only generic
session/wallet results. The host owns guarded navigation and contains no
provider-specific SDK, DTO, endpoint, or global bridge.

- Wallet remote origin: `environment.mfeWalletsRemoteUrl` (see `src/environments/`)
- Runtime bootstrap: `initFederation` in `src/main.ts` appends `/remoteEntry.js`

## 1) Runtime Channel: Host <-> MFE

### 1.1 Contract shape

Host and MFE communicate through:

- mount lifecycle
- typed input properties
- typed callbacks/events
- versioned payload envelopes

No direct imports from MFE internals into host domain logic.

### 1.2 Canonical event names

- `connection.state.changed`
- `connection.snapshot.updated`
- `wallet.connected`
- `wallet.disconnected`
- `wallet.account.changed`
- `wallet.chain.changed`

### 1.3 Event payload envelope (required)

```ts
export interface MfeEventEnvelope<TPayload = unknown> {
  eventName:
    | 'connection.state.changed'
    | 'connection.snapshot.updated'
    | 'wallet.connected'
    | 'wallet.disconnected'
    | 'wallet.account.changed'
    | 'wallet.chain.changed';
  eventVersion: number;
  traceId: string;
  timestamp: string; // ISO-8601
  source: 'mfe-wallets' | 'host';
  payload: TPayload;
}
```

### 1.4 Example event payloads

```ts
export interface WalletConnectedPayload {
  account: string;
  chainId: number | null;
  connector?: string;
}

export interface WalletErrorPayload {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}
```

## 2) API Channel: Host <-> NestJS BFF

### 2.1 Route + versioning

- All routes must be versioned: `/v1/...`
- Prefer additive evolution for request/response DTOs.

### 2.2 API response envelope (recommended)

```ts
export interface ApiResponseEnvelope<TData = unknown> {
  data: TData | null;
  error: ApiErrorEnvelope | null;
  meta?: {
    traceId?: string;
    timestamp?: string;
    [k: string]: unknown;
  };
}

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}
```

### 2.3 Mapping rule

- Never pass raw backend DTOs directly into presentational components.
- Map backend DTOs to host-owned domain models in `data-access` layer.

## 3) State Normalization Channel (host internal)

- External payloads (MFE events/API DTOs) must be normalized once.
- Normalized models are the only models used by host domain stores and UI.
- Keep global state minimal; keep domain state local to feature boundaries.

## 4) Compatibility and Change Policy

- Additive changes first.
- Any breaking event payload change requires `eventVersion` bump.
- Deprecate old event/API fields before removal.
- Update docs in both host and MFE when Level 2+ contracts change.

## 5) Validation Checklist

Before merging contract changes:

- Host starts and loads `mfe-wallets`.
- Canonical events are emitted/consumed without runtime parsing errors.
- `WalletsMfeMountApi.getSnapshot()` returns nullable `chainId` safely.
- `WalletsMfeMountApi.syncConnectedWallet?.()` restores an already-linked
  wallet when available and callers gracefully fall back when it is absent.
- At least one backend-connected flow validates API envelope handling.
- Error and fallback flows are verified (MFE unavailable or API failure).

## 6) Path B swap intent flow (host orchestration)

Host-owned sequence for near-intents swaps:

1. `POST /api/v1/swaps/prepare` (BFF) returns `ApprovedIntentPrepareRequest`
   after the host sends the Privy bearer token. The BFF checks that `signerId`
   and `authMethod` identify an active wallet link for that session before the
   wallet is asked to sign.
2. Host sends `PREPARE_INTENT_MESSAGE_REQUESTED` to wallet MFE
3. MFE builds `WalletMessage` via SDK only
4. Host sends `SIGN_REQUESTED`
5. MFE signs through gateway gates and emits `onIntentSigned`
6. Host calls authenticated `POST /api/v1/swaps/execute` with `signature`,
   `quoteHashes`, and user context. The returned `preparationId` is preserved in
   the execution payload and used as the stable `Idempotency-Key` header.
   (`prepareBroadcastRequest.prepareSwapSignedData` runs in the BFF execute
   handler.)

Quote and prepare requests keep the signing/refund account separate from the
destination recipient. `signerId` always identifies the connected wallet;
`recipient` may be a foreign-chain address and uses
`recipientType: DESTINATION_CHAIN`. Older BFF clients may omit these recipient
fields and retain the signer-as-recipient behavior.

The host exposes foreign-recipient routes only when
`environment.crossNetworkRecipientIntentSignEnabled` is enabled. Keep it
disabled until the deployed BFF accepts `recipient` / `recipientType` on both
quote and prepare requests. Wallet-funded swaps send `depositType: ORIGIN_CHAIN`
and `refundType: ORIGIN_CHAIN`, including NEP-141 assets. The MFE enables registered NEAR, EVM and TON funding adapters only when the host advertises `walletFundingVersion: '1.0.0'`; unsupported networks fail before confirmation. The prepared execution mode must match the requested funding
source. The wallet-funded flow must not request confidential Intents custody
for a wallet balance.

Host files:

- `src/app/mfe-contracts/intent-prepare.contract.ts`
- `src/app/mfe-contracts/gateway-events.ts`
- `src/app/domains/exchange/application/swap-quote.gateway.ts`
- `src/app/shared/mfe/wallets/wallet-gateway.bridge.service.ts`

Wallet MFE must expose `sendGatewayEvent` on `WalletsMfeMountApi`. Intent-sign
execution completes through `onIntentSigned`, after which the host publishes
the signed package through `POST /api/v1/swaps/execute`.

### Wallet swap contract (2.0.0)

The mount capability `swapContractVersion: '2.0.0'` exposes
`requestSwapQuote(input, { traceId, signal })` and `openWalletSwapReview(review)`.
The host also requires `executionReadinessVersion: '1.0.0'`: previews use the
authenticated selection and the MFE checks/reconnects the live provider on review.
Deploy the MFE before this host; older remotes receive an explicit update error.
Angular supplies product choices: backend-provided source/destination metadata,
atomic amount, expected account/network, recipient, slippage, and privacy choice.
It does not choose the provider, authentication method, funding/refund channels,
or request deadline. The MFE derives preview fields from the backend-selected wallet, then validates
the live account/network and backend ownership before final preparation. A
verified NEAR link is reused without another ownership signature. Missing proof
still uses the link challenge, and transaction/intent approvals remain required. Backend validation remains
authoritative; the host supplies authenticated transport ports, including
`quoteSwap`, and maps the existing BFF response into the quote contract.

The quote includes an MFE-owned `action` with support status, label, and user
explanation. Angular renders this guidance and disables review when unsupported.
Quote input changes cancel the transport through `AbortSignal`; a result for a
changed wallet is rejected by the MFE. No signing or deposit occurs on preview.
The review input adds display values and the current preview, then opens the
existing right-side drawer.

Deploy the MFE first. The new host rejects quote/review attempts on remotes
without v2 capability with an update message. The MFE retains legacy
`openSwapReview(SwapReviewIntent)` for old hosts during migration; it must not
infer Intents custody from a token identifier.

The MFE calls the prepare port for the final `dry: false` package, rejects
results whose amount/account/auth context does not match the immutable intent,
and ignores any response that is not from its latest request. It owns quote
expiry, refreshed-output disclosure, slippage-bound reconfirmation, and
single-flight submission. `intent_sign` packages use `signSwap` followed by
`submitSwap`. Wallet-funded `deposit_address` packages use `depositSwap` on
explicit confirmation. Both routes use the backend's stored preparation ID for
settlement tracking. It reports submission through `onSwapSubmitted` and requests a new host preview through
`onSwapPreviewRefreshRequested` when the executable change is outside policy.

The host remains responsible for the Trade form, shared balance source, dry
quote cancellation/versioning, and opening/closing the drawer. The MFE orchestrates
quote requests through the host transport; it does not own prices or token catalogs.

The optional `isSwapReviewBusy()` mount method reports signing, submission,
deposit, or settlement tracking. The host checks it before dismissing the swap
review drawer. The MFE keeps the review mounted after `onSwapSubmitted` until
settlement tracking finishes; the callback itself reports submission only.
Deploy the wallet MFE before the host so this guard is available when the host
starts using it. Older remotes can mount but retain the previous close behavior.

When the host dismisses the connection drawer, it sends `RESET`. The MFE must
abort any active provider pairing request before returning the gateway to idle,
so a dismissed QR code or wallet prompt cannot connect later.

## 7) Connected wallet dialog (balances board)

Ownership decision (follow this): `cs_mfe-wallets` **Gateway boundary** in
`AGENT_GUIDE.md`. Angular draws the board; the MFE is the gateway; the BFF
owns the numbers. Do not show a balance unless the gateway is `connected`.

Internal wiring sketch (event names, modal split): `connected-wallet-dialog.md`.
That file is not the agent source of truth.

## 8) Connected Wallet Restore

For linked-wallet profile flows, the host may request a best-effort restore of
an already connected wallet before opening the wallet modal:

```ts
export type WalletsMfeMountApi = {
  getSnapshot: () => WalletConnectionSnapshot;
  syncConnectedWallet?: () => Promise<WalletConnectionSnapshot>;
};

export type WalletConnectionSnapshot = {
  account: string | null;
  chainId: number | null;
};
```

`syncConnectedWallet` is optional for backward compatibility. If the mounted
remote does not expose it, or if restore fails, the host should still open the
wallet modal so the user can connect manually.

For NEAR connections, the optional `linkStatus` snapshot field reports
`checking`, `unlinked`, `linking`, `linked`, or `error`. While it is present and
not `linked`, the host keeps the wallet MFE visible in the drawer so users can
choose its separate Link wallet action. Older remotes without this field retain
the existing connected-wallet view. For snapshot-capable remotes, the host waits
for the connected snapshot before deciding whether to close the drawer; legacy
callback-only remotes still close it when the account callback arrives.

## 9) Suggested file placement

If/when extracting typed contracts into code, place them under:

- `src/app/mfe-contracts/events.ts`
- `src/app/mfe-contracts/payloads.ts`
- `src/app/mfe-contracts/api-envelope.ts`

Keep this README updated alongside those files.

### Exchange settlement notification

The optional `onSwapSettled({ traceId, status })` callback reports confirmed
`SUCCESS`, `REFUNDED`, `FAILED`, or `INCOMPLETE_DEPOSIT` from the MFE's status
actor. It is separate from `onSwapSubmitted`, which only confirms submission.
The host refreshes wallet balances on settlement because a submission-time
refresh may run before destination funds arrive. The callback does not dismiss
the receipt. Older remotes remain compatible but do not emit this notification.

### Active wallet selection (selection capability 1.0.0)

The backend `WalletLink.isPrimary` is the persisted account preference. The host
passes `context.selection` before mounting and forwards confirmed session changes
through `updateSelection`. Pending/unauthenticated context cannot automatically
hydrate a wallet. Authenticated context carries user ID and the selected wallet's
ID, address, chain, type and source, or null when none remains.

Selection is independent of `WalletConnectionSnapshot`: an external wallet stays
selected with Reconnect required until its provider connects. Browser hints and
provider readiness cannot change selection. The MFE owns connector routing; the
host does not read MFE storage. Selection changes reset the gateway and invalidate
pending restoration; unmount clears the host's live snapshot.

Deploy backend registration protection, then the selection-capable MFE, then the
host. The host requires `selectionContractVersion: '1.0.0'` and `updateSelection`;
older remotes show an update/retry message. Authentication remains at 2.3.0.

## Restoration status and read-only holdings

`WalletConnectionSnapshot.restorationStatus` is an additive optional field:
`pending`, `restoring`, `complete`, or `failed`. It describes the non-interactive
provider-session attempt, not authentication or signing authorization. Older
remotes may omit it. Selected external sessions are restored through connector
session reads, matched against the backend selection; restoration never requests
a signature or selects an embedded fallback. Verification and safety checks
remain mandatory for signing.

The host owns root-lifetime, authenticated balances for its selected wallet and
network. Gateway invalidation clears signing readiness, not those read-only
holdings. The standard connection drawer is opened explicitly for connection or
signing; the wallet-details view consumes the same host balance source.

### Dialog close ownership

The optional mount capability `dialogCloseVersion: '1.0.0'` guarantees an MFE
close control for connection, connected/linking, and swap views. `WalletsComponent`
emits `dialogCloseReady` only after a compatible mount succeeds; loading,
legacy remotes, failed mounts and unmount retain or restore the host fallback.
The host board always keeps its own close control. Deploy the MFE before the
host; older remotes may show both controls during migration.

Remote close controls invoke `onCloseRequested`. The host never intercepts
remote CSS selectors or accessible labels. All host close paths retain the
busy-swap guard. Dismissal preserves a connected gateway; closing an unfinished
connection cancels it. Disconnect remains an explicit wallet action.

### Wallet funding v1

Both mount capabilities and host services advertise optional
`walletFundingVersion: '1.0.0'`. Prepare requests carry `sourceAssetId` and
`network`; the BFF binds the selected quote's input atomics, sender, network,
registered contract and provider destination/memo into persisted `payload.funding`.
The MFE validates those bindings and sends `depositSwap.transaction` using the
mirrored `wallet-funding.contract.ts` envelope: native/EVM fields, NEAR actions,
or TON Connect messages. The host verifies the sender and forwards that exact
envelope through the verified gateway. No arbitrary approval transaction is used.
Older hosts retain native NEAR only; token routes must not fall back to a native
transfer. Deploy BFF, then MFE, then host. Rolling back the host disables new
non-native routes, while existing preparations remain available for settlement.
TON submission reports `ton-message:<hash>` as an external-message reference;
only backend settlement status confirms completion. Ambiguous submission errors
must reconcile that preparation before another transfer.
