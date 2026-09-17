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
   chart, and supporting links.
4. A full-width recent-activity table below the two-column top section.

On desktop, the top grid uses a `42% / 58%` split for the swap and market
panels. At `1100px` and below, it changes to a single-column layout.

### Swap panel

| Block          | Markup            | Behavior                                                 |
| -------------- | ----------------- | -------------------------------------------------------- |
| From row       | `.swapRow.first`  | Token selector, balance, amount input, and USD estimate  |
| Flip control   | `.swapCircle`     | Swaps the selected tokens and reloads market comparison  |
| To row         | `.swapRow`        | Token selector, balance, quoted amount, and USD estimate |
| Details        | `.stats`, `.stat` | Rate, price impact, slippage, and network fee            |
| Primary action | `.connectMain`    | Opens final MFE review after a current dry quote         |

Token selectors open `app-side-modal` with `app-token-select-panel`. Amount
editing, paste guards, and decimal validation remain owned by `HomeComponent`.

### Market panel

The market panel supports Price, Volume, and Liquidity views and the `1H`, `1D`,
and `1W` comparison windows. The backend comparison contract does not currently
provide a `1M` window.

The relative-performance chart renders the quote-token move minus the base-token
move. Keep the summary column compact so the chart retains most of the available
width.

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
- The current intents backend executes native NEAR routes through
  `nep141:wrap.near`, represented by `ExchangeToken.executionAssetId`; this
  does not change the balance/display identity.

The missing native balance was caused by mapping the backend wrapped-NEAR asset
to a display token named NEAR and then matching balances against that NEP-141
id. Portfolio used the shared connected-wallet balance feed, whose native row is
`near:native`, so Trade could not match the known native row and displayed an
unavailable/zero-like balance. Trade now consumes the same
`ConnectedWalletBalancesFacade`, preserves exact asset ids during filtering and
deduplication, and invalidates its balance subscription on account or network
changes.

### Quote and review lifecycle

The host owns amount/token/settings input, balance gating, and debounced dry
quotes. Every quote-affecting value is part of the request key. Changing or
invalidating input clears the preview and cancels the active observable; a
monotonic request version additionally prevents late responses from updating
state. The connected-wallet action is `Review` and is enabled only for a current,
unexpired preview with no newer request pending.

`Review` opens the wallet MFE in the existing right-side drawer and passes a
versioned immutable swap intent. The MFE owns the non-dry prepare request, final
amount disclosure, expiry/retry state, reconfirmation within slippage policy,
wallet signing, single-flight submission, and success callback. Authenticated
BFF calls remain host transport services so the MFE does not duplicate session
or API-client logic.

## Styling contract

Keep exchange-specific rules scoped below `.exchange-page` in
`src/styles/exchange-page.scss`; do not leak them into global shell styles. Use
the canonical tokens and dimensions in the [branding guide](branding.md).

Important page targets:

- swap panel padding: `24px`
- market panel padding: `24px 28px`
- swap row height: `112px`
- stats row height: `70px`
- market panel desktop height: `486px`
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
