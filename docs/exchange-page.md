# Exchange page reference

The default route (`/`) renders the Token Exchange screen inside the host shell.
The page is public: guests can browse quotes and markets without a login
session. Connecting a wallet is required only to submit a swap.
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

| Block          | Markup            | Behavior                                                 |
| -------------- | ----------------- | -------------------------------------------------------- |
| From row       | `.swapRow.first`  | Token selector, clickable max balance, amount input, USD estimate |
| Flip control   | `.swapCircle`     | Swaps the selected tokens and reloads market comparison  |
| To row         | `.swapRow`        | Token selector, clickable max balance, quoted amount, USD estimate |
| Details        | `.stats`, `.stat` | Rate, price impact, editable slippage, and network fee   |
| Primary action | `.connectMain`    | Opens final MFE review after a current dry quote         |

Token selectors open `app-side-modal` with `app-token-select-panel`. Amount
editing, paste guards, and decimal validation remain owned by `HomeComponent`.
Clicking a usable From balance prefills only the From amount. Clicking a usable
To balance stores a destination target for display only; Review stays disabled
until the quoted output matches that target, and review payloads always use the
quoted `amountOut` (never the balance override). Slippage opens
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
**Token details** block shows From (left) and To (right) metadata: symbol,
name, icon, network, shortened contract (when present), and decimals. Price
comes from the active market comparison for the selected From/To pair
(positional base/quote), with optional snapshot price override when
`GET /api/v1/markets/snapshots` returns a non-zero `priceUsd`. Market Cap and
24h Volume render only when snapshots include non-zero values — never as empty
placeholders. On viewports `<= 1100px` the two columns stack. Details update
when the swap pair changes or flips.

### Recent activity

The activity table shows time, pair, sold amount, received amount, and status.
Its rows are currently host-owned demo data in `HomeComponent.recentActivity`
until backend history is integrated.

## API and asset ownership

| Action            | Endpoint                         | Owner                             |
| ----------------- | -------------------------------- | --------------------------------- |
| Dry quote         | `POST /api/v1/quotes/one-click`  | NestJS BFF                        |
| Market comparison | `GET /api/v1/markets/comparison` | NestJS BFF                        |
| Wallet balances   | `POST /api/v1/balances`          | NestJS BFF                        |
| Final preparation | `POST /api/v1/swaps/prepare`     | Wallet MFE through host transport |
| Swap submission   | `POST /api/v1/swaps/execute`     | Wallet MFE through host transport |
| Settlement status | `GET /api/v1/swaps/status/:preparationId` | Wallet MFE through host transport |

Client token metadata in `HomeComponent.exchangeTokens` is display and
bootstrap data only. The backend is authoritative for tradability, chain
mapping, quote validation, and execution eligibility.

The host requests every backend-allowlisted asset for the connected wallet's
CAIP-2 network, splitting the catalog into API requests of at most 20 asset ids.
Balance responses are matched by exact `network` and `assetId`, never display
symbol, and a response containing a different wallet or network is rejected. A
response with `meta.partial: true` is shown as incomplete even when it contains
usable rows. Expired or `stale: true` values may be shown as stale context but
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
deduplication, and invalidates its balance subscription on account or network
changes.

### Active wallet and automatic balances

The authenticated backend wallet list owns the active selection through
`isPrimary` and `PATCH /api/v1/wallets/:walletId/primary`. Profile and Trade
consume `ActiveWalletFacade`; browser connection history does not select an
account wallet. An available primary wallet is restored after session loading,
and a matching live MFE connection is required to sign. A linked wallet without
that connection shows an explicit reconnect state.

The facade shares balance loading across Profile and Trade once session,
selected wallet, and network are resolved. Requests are scoped to account,
session, wallet, and network; switching context cancels old subscriptions and
clears their rows. Manual Refresh retries failures, and confirmed settlement
refreshes balances. A closed wallet drawer does not mount another balance view.
Late wallet-list responses cannot overwrite an active primary-wallet mutation.

Review accepts a valid dry-run preview; the MFE obtains the execution quote in
the review flow. Authentication, signing readiness, source balance freshness,
amount, network, and quote expiry remain required. The UI explains unmet
requirements and re-evaluates expiry without a wallet event. A connected,
account-linked wallet awaiting verification exposes **Verify wallet** before
quote review, using the existing MFE `VERIFY_REQUESTED` event. While the wallet
prompt is open the action is disabled. A failed/cancelled verification offers
**Reconnect to verify**, since the public gateway contract has no retry event.
Quotes and review remain blocked until a verified snapshot arrives.

### Quote and review lifecycle

The host owns amount/token/settings input, balance gating, and debounced dry
quotes. Every quote-affecting value is part of the request key. Changing or
invalidating input clears the preview and cancels the active observable; a
monotonic request version additionally prevents late responses from updating
state. The connected-wallet action is `Review` and is enabled only for a current,
unexpired preview with no newer request pending. If a quote request fails, the
action changes to `Retry quote` and remains available while the form and wallet
balance are still valid, so the user can request a fresh quote manually.

`Review` opens the wallet MFE in the existing right-side drawer and passes a
v2 product input and current preview. The MFE owns both dry quote request
configuration and the non-dry prepare request, final
amount disclosure, expiry/retry state, reconfirmation within slippage policy,
wallet signing, single-flight submission, and success callback. Authenticated
BFF calls remain host transport services so the MFE does not duplicate session
or API-client logic.
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
- swap / market desktop height: `560px` (fits Review CTA without clipping)
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
