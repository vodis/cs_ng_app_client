# Exchange page reference

The default route (`/`) renders the Token Exchange screen inside the host shell.
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
| Primary action | `.connectMain`    | Submits through `submitQuote()` and follows wallet state |

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

| Action            | Endpoint                         | Owner      |
| ----------------- | -------------------------------- | ---------- |
| Dry quote         | `POST /api/v1/quotes/one-click`  | NestJS BFF |
| Market comparison | `GET /api/v1/markets/comparison` | NestJS BFF |

Client token metadata in `HomeComponent.exchangeTokens` is display and
bootstrap data only. The backend is authoritative for tradability, chain
mapping, quote validation, and execution eligibility.

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
