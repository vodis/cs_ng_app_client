# MFE Contracts

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
version `1.0.0` before mounting `mfe-wallets/auth-provider`.

The NestJS `GET /api/v1/public/auth-config` response is the single source of
truth for enabled login methods and public provider configuration. The host owns
application session bootstrap and guarded navigation. `mfe-wallets` owns the
browser provider instance and all wallet discovery/signing operations. No
provider bridge is published on `window`.

- Runtime manifest: `src/config/mf.manifest.json`

## 1) Runtime Channel: Host <-> MFE

### 1.1 Contract shape

Host and MFE communicate through:

- mount lifecycle
- typed input properties
- typed callbacks/events
- versioned payload envelopes

No direct imports from MFE internals into host domain logic.

### 1.2 Canonical event names

- `wallet.connected`
- `wallet.disconnected`
- `wallet.accountChanged`
- `wallet.chainChanged`
- `wallet.txSigned`
- `wallet.error`

### 1.3 Event payload envelope (required)

```ts
export interface MfeEventEnvelope<TPayload = unknown> {
  eventName:
    | 'wallet.connected'
    | 'wallet.disconnected'
    | 'wallet.accountChanged'
    | 'wallet.chainChanged'
    | 'wallet.txSigned'
    | 'wallet.error';
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
  chainId: number;
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
- At least one backend-connected flow validates API envelope handling.
- Error and fallback flows are verified (MFE unavailable or API failure).

## 6) Path B swap intent flow (host orchestration)

Host-owned sequence for near-intents swaps:

1. `POST /api/v1/swaps/prepare` (BFF) returns `ApprovedIntentPrepareRequest`
2. Host sends `PREPARE_INTENT_MESSAGE_REQUESTED` to wallet MFE
3. MFE builds `WalletMessage` via SDK only
4. Host sends `SIGN_REQUESTED`
5. MFE signs through gateway gates and emits `onIntentSigned`
6. Host calls `POST /api/v1/swaps/execute` with `signature`, `quoteHashes`, and user context  
   (`prepareBroadcastRequest.prepareSwapSignedData` runs in the BFF execute handler)

Host files:

- `src/app/mfe-contracts/intent-prepare.contract.ts`
- `src/app/mfe-contracts/gateway-events.ts`
- `src/app/domains/exchange/application/swap-execution.workflow.ts`
- `src/app/shared/mfe/wallets/wallet-gateway.bridge.service.ts`

Wallet MFE must expose `sendGatewayEvent` on `WalletsMfeMountApi` and `onIntentSigned` callback for the full flow to complete.

## 7) Suggested file placement

If/when extracting typed contracts into code, place them under:

- `src/app/mfe-contracts/events.ts`
- `src/app/mfe-contracts/payloads.ts`
- `src/app/mfe-contracts/api-envelope.ts`

Keep this README updated alongside those files.
