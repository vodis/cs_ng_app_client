# Connected wallet dialog — host wiring sketch (internal)

This is not the repository source of truth. The architecture and agent guides
take precedence.

## Ownership and flow

The wallet MFE owns provider discovery, connection state, account identity,
signing, and transaction submission. Angular owns authenticated BFF calls and
the connected-wallet balance UI. NestJS owns provider selection, token
metadata, decimals, freshness, and normalized balances.

Angular keeps `<app-wallets>` mounted while its connected board is visible. On
a connected snapshot it derives the CAIP-2 network, loads `/api/v1/assets`, and
calls `POST /api/v1/balances` once for the native asset and in bounded batches
for the configured token asset IDs. The active request key contains both the
normalized account and network, and network/account changes cancel the prior
subscription and reject late results.

```text
MFE connection snapshot (account + chain identity)
          |
          v
Angular selects CAIP-2 network and asset IDs
          |
          v
NestJS POST /api/v1/balances (host bearer token)
          |
          v
Angular renders exact-account, exact-network rows
```

`balances.updated` and `BALANCES_SYNC_REQUESTED` are deprecated 2.1 migration
shapes. New host code must not use them. Never pass an access-token callback to
the wallet MFE.

The board may display a result only when its returned `walletAddress` and
`network` exactly match the active request. Missing provenance is an invalid
response, not a value to fill from UI state. Empty results remain empty; do not
invent token amounts or label cached rows as another network.
