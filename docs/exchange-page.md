# Exchange page reference

The default route (`/`) renders the Token Exchange screen inside the host shell.
The page is public: guests can browse indicative prices and markets without a login
session. Guest estimates exclude destination delivery fees; connecting a wallet requests
a destination-specific quote. Connecting a wallet is required only to submit a swap.
Treat this document as the product baseline when changing the page structure,
behavior, or styles.

## Ownership and source files

| Area                      | Route                      | Primary files                   |
| ------------------------- | -------------------------- | ------------------------------- |
| Header and wallet control | Global                     | `src/app/components/header/`    |
| Sidebar navigation        | `/`, `/farm`, `/proposals` | `src/app/components/sidebar/`   |
| Application frame         | Global                     | `src/app/components/layout/`    |
| Token Exchange page       | `/`                        | `src/app/pages/home/`           |
| Exchange styles           | `/`                        | `src/styles/exchange-page.scss` |

Wallet connection lives in the header through `app-wallet-bar` from the wallet
MFE. Submitting a swap also requires a connected wallet.

## Page structure

The page contains:

1. An intro banner with the Token Exchange title and CraftScript subtitle.
2. A swap panel with token selectors, amount fields, rate details, and the
   wallet-aware primary action.
3. A market panel with pair summary, timeframe controls, relative-performance
   chart, Market/Product mock labels, and supporting note text.
4. A full-width recent-activity table below the two-column top section.

On desktop, the top grid uses a `42% / 58%` split for the swap and market
panels. At `1100px` and below, it changes to a single-column layout.

### Swap panel

| Block          | Markup            | Behavior                                                           |
| -------------- | ----------------- | ------------------------------------------------------------------ |
| From row       | `.swapRow.first`  | Token selector, clickable max balance, amount input, USD estimate  |
| Flip control   | `.swapCircle`     | Swaps the selected tokens and reloads market comparison            |
| To row         | `.swapRow`        | Token selector, clickable max balance, quoted amount, USD estimate |
| Details        | `.stats`, `.stat` | Rate, price impact, editable slippage, and network fee             |
| Primary action | `.connectMain`    | Confirms a fresh balance, then opens MFE review                    |

Token selectors open `app-side-modal` with `app-token-select-panel`. Amount
editing, paste guards, and decimal validation remain owned by `HomeComponent`.
Clicking a usable From balance prefills the From amount. Native assets use the
backend spendable estimate, reserving storage and gas; final preparation validates
actual funding again. Destination balances are read-only. The exact-receive control
switches to `EXACT_OUTPUT`, keeps the receive amount fixed, and requests its input
cost. The quote mode participates in cancellation and preparation identity.
Slippage opens
`app-slippage-settings-panel` with presets
(`0.1%`, `0.25%`, `0.5%`, `1%`, `3%`) plus custom input. The host stores the
choice as basis points (default `50` = `0.5%`) and includes it in dry quote and
review intent payloads.

### Market panel

The market panel supports Price, Volume, and Liquidity views and the `1H`, `1D`,
and `1W` comparison windows. The backend comparison contract does not currently
provide a `1M` window.

The relative-performance chart renders the quote-token move minus the base-token
move. Keep the summary column compact so the chart retains most of the available
width. The Advanced Chart entry control is hidden for now; advanced market view
state and `app-live-chart` wiring remain in `HomeComponent` for a later return.

Under the chart, the right-hand info area shows temporary **Market** and
**Product** mock labels (`Spot` / `Token Exchange`) until the BFF exposes real
metadata.

Directly under the pair summary inside the same market panel, a compact
**Token marketing** block shows From (left) and To (right) in a CoinMarketCap-
style row layout: muted labels on the left, compact pills/icons on the right.
Market Cap is shown only when
`GET /api/v1/markets/snapshots` returns a positive `marketCapUsd` — host mocks
are not used for that figure, so a failed/empty snapshot does not invent values
like `$32B`. Website, Whitepaper, Socials, and Explorers still use host-owned
mocks in `token-project.mock.ts` until those snapshot fields exist. Explorers
prefer the selected token’s network and contract via `explorerUrlForToken`, so
bridged assets (e.g. USDC on Base) do not open the Ethereum mock link. Price and
24h Volume are omitted from this block (pair price stays in the market summary).
Technical fields (Network, Contract, Decimals) are omitted. On viewports
`<= 1100px` the two columns stack.

### Recent activity

The activity table shows time, pair, sold amount, received amount, and status.
Its rows are currently host-owned demo data in `HomeComponent.recentActivity`
until backend history is integrated.

## API and asset ownership

| Action            | Endpoint                                  | Owner                             |
| ----------------- | ----------------------------------------- | --------------------------------- |
| Dry quote         | `POST /api/v1/quotes/one-click`           | NestJS BFF                        |
| Market comparison | `GET /api/v1/markets/comparison`          | NestJS BFF                        |
| Wallet balances   | `POST /api/v1/balances`                   | NestJS BFF                        |
| Final preparation | `POST /api/v1/swaps/prepare`              | Wallet MFE through host transport |
| Swap submission   | `POST /api/v1/swaps/execute`              | Wallet MFE through host transport |
| Settlement status | `GET /api/v1/swaps/status/:preparationId` | Wallet MFE through host transport |

Client token metadata in `HomeComponent.exchangeTokens` is display and
bootstrap data only. The backend is authoritative for tradability, chain
mapping, quote validation, and execution eligibility.

The host requests every backend-allowlisted asset for the connected wallet's
CAIP-2 network, splitting the catalog into API requests of at most 20 asset ids.
Balance responses are matched by exact `network` and `assetId`, never display
symbol, and a response containing a different wallet or network is rejected. A
response with `meta.partial: true` is shown as incomplete even when it contains
usable rows. Expired or `stale: true` values may be retained as last known context but
must not authorize a swap. The UI must not substitute demo or zero balances when
the backend has no fresh result, and failed requests remain retryable after
provider initialization or a transient backend failure.

The source-token selector shows a **Your tokens** section between search and the
full token catalog when a wallet is connected. It includes only non-zero,
network-specific balances for the connected wallet, renders each entry as
`Token_Network` with its available token amount, and selects the exact 1Click
asset id. Destination-token selection continues to use the full supported asset
and network flow.

### Native NEAR identity

Balance/display identity and execution identity are intentionally separate:

- Native NEAR uses canonical balance asset id `near:native` and symbol `NEAR`.
- Wrapped NEAR uses NEP-141 asset id `nep141:wrap.near` and symbol `wNEAR`.
- `PUBLIC_NEAR` remains its own NEP-141 token and is never a native-balance
  fallback.
- Native NEAR quotes use `nep141:wrap.near` as the provider asset identifier,
  with `ORIGIN_CHAIN` deposit and refund routing. The wallet sends native NEAR
  to the prepared 1Click deposit address; it does not sign a transfer from an
  unfunded Intents account. USDC delivery remains on the destination chain.
- Deposit submission remains pending until provider settlement succeeds. Deploy
  the backend preparation storage change, then wallet settlement tracking,
  then the host routing change. No contract version or schema change is needed.

The missing native balance was caused by mapping the backend wrapped-NEAR asset
to a display token named NEAR and then matching balances against that NEP-141
id. Portfolio used the shared connected-wallet balance feed, whose native row is
`near:native`, so Trade could not match the known native row and displayed an
unavailable/zero-like balance. Trade now consumes the same
`ConnectedWalletBalancesFacade`, preserves exact asset ids during filtering and
deduplication, and invalidates shared balance requests on account or network
changes.

### Active wallet and automatic balances

The authenticated backend wallet list owns the active selection through
`isPrimary` and `PATCH /api/v1/wallets/:walletId/primary`. Profile and Trade
consume `ActiveWalletFacade`; browser connection history does not select an
account wallet. An available primary wallet is restored after session loading,
and a matching live MFE connection is required to sign. A linked wallet without
that connection remains readable; signing actions offer the standard connection flow.

The facade shares balance loading across Profile and Trade once session,
selected wallet, and network are resolved. Requests are scoped to account,
session, wallet, and network; switching context cancels old subscriptions and
clears their rows. Manual Refresh retries failures, and confirmed settlement
refreshes balances. A closed wallet drawer does not mount another balance view.
Late wallet-list responses cannot overwrite an active primary-wallet mutation.

Review accepts a valid dry-run preview for the authenticated backend-selected
wallet. The host checks product inputs, source balance freshness, network and
quote expiry. Quotes do not require a connected or verified browser signer.
There is no separate host **Verify wallet** action or safety-provider gate.

When the user opens review, the MFE reconnects the selected provider if needed,
checks the live account/network and confirms backend ownership before final
preparation. Existing verified NEAR links are reused without another message
signature; a missing ownership marker requires the initial link proof. The
transaction or intent approval remains an explicit action after review. Wallet
or user changes cancel pending readiness and prevent stale execution.

### Quote and review lifecycle

The host owns amount/token/settings input and debounced dry quotes. A dry quote
does not require a spendable balance, so the user can preview a route before
the wallet can fund it. Every quote-affecting value is part of the request key.
Changing or invalidating input clears the preview and cancels the active
observable; a monotonic request version additionally prevents late responses
from updating state. Displayed balances are context only. The host does not
block the dry quote on a missing, stale, or insufficient balance, and it does
not show a balance-loading error.

The connected-wallet action is `Review` and is enabled for a current, unexpired
preview with no newer request pending. If a dry quote request fails, the action
changes to `Retry quote` and stays available while the form is still valid.

`Review` confirms the source balance with a fresh backend read for the linked
address and starts the executable (`dry: false`) preparation at the same time.
If that balance check fails, the host cancels the preparation and replaces the
button label with the failure, for example `Insufficient NEAR balance`. A
confirmed balance opens the wallet MFE in the existing right-side drawer with a
versioned immutable swap intent. The dialog adopts the executable quote already
in flight and renders its result, or an error with a requote action when
preparation fails. The MFE owns final amount disclosure, expiry/retry state,
reconfirmation within slippage policy, wallet signing, single-flight
submission, and the success callback. Authenticated BFF calls remain host
transport services so the MFE does not duplicate session or API-client logic.
The dialog receives the v2 product input and current preview. Dry quote
configuration stays with the MFE; Review starts the executable preparation in
parallel with the balance check and cancels it when the balance cannot fund
the swap.

Executable preparation and requotes preserve `sourceAssetId` and `network`;
both fields are part of the in-flight quote identity. Balance confirmation
uses the same backend-provided `balanceAssetId` and canonical asset matching
as displayed holdings, restricted to the requested account and network.

Final preparation sends the user's bearer token; the BFF checks that the signer
is an active wallet link before the MFE asks the wallet to sign. Deploy this host
change before enforcing the authenticated preparation endpoint in the BFF.

Exchange balances represent assets in the connected wallet. Both dry quotes
and final preparation use `depositType: ORIGIN_CHAIN`, `refundType: ORIGIN_CHAIN`,
and `recipientType: DESTINATION_CHAIN`. A NEP-141 execution asset identifier
identifies the token; it does not mean the wallet has an Intents balance.
Confidential mode is unavailable for this wallet-funded flow until its separate
1Click confidentiality contract is supported. Never substitute
`CONFIDENTIAL_INTENTS` funding for a wallet balance.
Native NEAR deposits are supported. The MFE rejects other origin-chain deposits
before confirmation until their chain/token transfer adapters are implemented.
The MFE discloses the source wallet and recipient, requests a wallet transfer,
and tracks settlement through the BFF. Existing Intents-balance callers may
still sign the provider-generated message and submit it through the backend.
The MFE selects `one-click` in both preview and final preparation requests so the BFF does
not substitute a solver-relay quote for this flow.
An intent hash confirms submission. Only `SUCCESS` confirms settlement;
`REFUNDED` and `FAILED` are shown separately.

## Styling contract

Keep exchange-specific rules scoped below `.exchange-page` in
`src/styles/exchange-page.scss`; do not leak them into global shell styles. Use
the canonical tokens and dimensions in the [branding guide](branding.md).

Important page targets:

- swap panel padding: `24px`
- market panel padding: `24px 28px`
- swap row height: `112px`
- stats row height: `70px`
- swap panel minimum desktop height: `560px`, growing with disclosure and recovery text; market panel height: `560px`
- market summary/chart grid: `104px / 1fr`
- numeric amount font: `Aeonik Fono` through `.amount`

## Change checklist

1. Change the home template structure only when the product layout changes.
2. Mirror class renames in `src/styles/exchange-page.scss`.
3. Preserve wallet gating, token selection, quote submission, and comparison
   reload when flipping tokens.
4. Verify both the desktop split and the mobile single-column breakpoint.
5. Run lint, unit tests, and the production build.
6. Run `pnpm run e2e` for changes to the shell, header, sidebar, or exchange
   page chrome.

Shell regression coverage lives in `e2e/shell-layout.spec.ts`. It protects the
64px header, content alignment, persistent divider, one-seventh desktop sidebar,
and shared grid row for the sidebar, divider, and routed content.

### Wallet swap request ownership

Home sends asset metadata, amount, recipient, expected account/network, slippage,
and privacy choice to the MFE through `SwapQuoteGateway`. It does not construct
provider funding/authentication fields or deadlines. The host keeps debounce,
refresh, cancellation, HTTP/session transport, and display; the MFE returns
quote action guidance and resolves the live wallet context. See the
[v2 wallet swap contract](../src/app/mfe-contracts/README.md#wallet-swap-contract-200)
for compatibility and deployment order.

The MFE shows exchange progress and a receipt after confirmation. Its additive
`onSwapSettled` callback refreshes wallet balances after confirmed completion or
another terminal provider result; submission alone is too early to show the
updated destination balance. Closing the receipt remains a user action.

Balance loading is independent of connector restoration. The shared root store
survives route subscriptions, retains same-wallet rows while revalidating, and
rejects responses from previous user/wallet/network contexts. Empty, loading,
partial and failed reads have distinct UI states. Asset matching uses canonical
IDs plus network, including equivalent NEP-141 prefixes and EVM native-address
sentinels; native NEAR and wrapped NEAR remain separate holdings.
Partial refreshes replace successfully read assets and retain missing holdings
as stale within the same user/wallet/network context. A complete response
replaces the retained holdings, including confirmed zero or empty balances.

### Balance refresh, USD estimates and wallet funding

Ordinary refreshes retain the current balance label without a freshness suffix.
Concurrent refresh requests coalesce into one pending refresh; a wallet/network
change cancels old work and clears the queued refresh. Internal freshness still
controls eligibility; partial/error responses never become authoritative balances.
The UI never renders the word “stale”.

Swap USD estimates multiply canonical decimal amounts by the exact asset's
backend price using integer arithmetic and round to cents (`0.146146` USDC at
`0.999734` USD becomes `$0.15`). Missing asset prices display `—`; symbol-based
market comparison prices are not a fallback. Positive sub-cent values show
`<$0.01`. Display grouping is never reparsed as a canonical amount.

Origin-chain transfers now use the additive wallet funding contract documented
in `src/app/mfe-contracts/README.md`; the backend, MFE, and host must be rolled
out together in that order. A valid dry quote alone does not prove wallet
ownership, available gas, or an executable transfer adapter.

The assets API provides optional `balanceAssetId` for native provider routes.
The host matches it to native RPC holdings while preserving `assetId` for quotes
and execution. Native classification is backend-owned and never inferred from
a missing contract or display symbol.

USD swap estimates consume asset-ID-bound prices from the BFF asset list. Prices
refresh every minute without changing selected assets, amounts or active quotes.
Overlapping refreshes are coalesced. Missing, invalid, future or older-than-five-minute
`priceUpdatedAt` values render an unavailable estimate (`—`), including when refresh
requests fail. Symbol-based market snapshots never substitute for an asset price.

### Swap UX and recovery contract

- Guest `POST /api/v1/quotes/preview` is always indicative and dry. The BFF owns
  its anonymous Intents pricing configuration and returns only amounts and a
  30-second display lifetime, never a deposit or signing package. Connecting a
  wallet replaces this estimate with the requested destination delivery quote.
- Quote refresh follows the preview expiry with a five-second safety margin,
  bounded between five and sixty seconds. A successful refresh clears errors;
  pending refreshes and failed refreshes cannot authorize Review.
- `GET /api/v1/swaps/policy` supplies the current slippage maximum. Settings
  warn at 3% and above. The server remains authoritative if policy loading fails.
- The v2 wallet contract adds optional `swapType` and `amountInAtomic`; omitted
  mode remains exact-input. Host exact-output requires the remote capability
  `exactOutputVersion: '1.0.0'`, including again when opening review.
- Exact-output `amountIn` includes the provider slippage buffer. Display it as
  Maximum paid without adding slippage again. Requotes disclose changed input,
  require acceptance within the review tolerance and block changes beyond it.
- Native Max calls authenticated `POST /api/v1/swaps/spendable`. This is an
  estimate with gas reserve, not a promise that the final transfer is executable.
  Late estimates are discarded when the form, selected wallet or network changes.
