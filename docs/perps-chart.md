# Perps Price Chart

> The candlestick/line price chart on the perps trading page (`/perps/[coin]`, e.g. `near.com/perps/JTO`).

This document explains how the chart is built, where its data comes from, the
library it uses, and the features it ships.

---

## 1. Overview

The perps chart is a lightweight, real-time price chart rendered by the
[`liveline`](https://www.npmjs.com/package/liveline) library. It shows the
recent price history of a Hyperliquid perpetual market in either **line** or
**candlestick** mode, over a selectable time window (1H / 4H / 1D / 1W), with a
live price that updates in real time over a WebSocket.

When the user holds a position in the market, the chart also overlays a
reference line at their entry price (labelled `Long`/`Short`).

```
┌──────────────────────────────────────────────┐
│  JTO  $X.XX   +1.23%        ← header (24h)     │
│                                                │
│        ╱╲      ╱╲       ← liveline chart        │
│   ╱╲ ╱   ╲╱╲ ╱   ╲___  ← live price + pulse     │
│  ─────────────── Long $X.XX  ← entry ref line  │
│                                                │
│  [1H] [4H] [1D] [1W]            [candle/line]  │
└──────────────────────────────────────────────┘
```

---

## 2. Library

|                     |                                                                      |
| ------------------- | -------------------------------------------------------------------- |
| **Charting**        | `liveline` `0.0.7`                                                   |
| **Data SDK**        | `@nktkas/hyperliquid` `0.32.1` (community Hyperliquid TS SDK)        |
| **State / caching** | `@tanstack/react-query` (polling), `zustand` (persisted UI settings) |

`liveline` is a small canvas-based chart library purpose-built for live
financial data. It is **not** TradingView, `lightweight-charts`, or `recharts`.
It is given the full dataset plus a single "current value" and handles
auto-scaling, animated transitions (`lerpSpeed`), the live badge, momentum
shading, the pulse dot, grid, and hover/scrub interaction internally.

The component is **dynamically imported with SSR disabled** on the page (it is a
canvas/`"use client"` component and must not render on the server).

---

## 3. Data sources

All chart data comes from **Hyperliquid**, through two channels:

### 3.1 Historical candles (REST, polled)

`getCandleData()` calls Hyperliquid's `candleSnapshot` endpoint and normalizes
each candle into the internal `HLCandle` shape:

```ts
// src/features/trade/hyperliquid/services/hyperliquidService.ts
type HLCandle = {
  time: number; // bucket start (ms epoch)
  value: number; // close price (alias of close, used by line mode)
  open: number;
  high: number;
  low: number;
  close: number;
};
```

It is consumed via the `useHyperliquidCandles` React Query hook:

```ts
// src/features/trade/hyperliquid/hooks/useHyperliquidTradeData.ts
useQuery({
  queryKey: hyperliquidQueryKeys.candles(coin, interval, lookbackMs),
  queryFn: ({ signal }) => getCandleData(coin, interval, lookbackMs, signal),
  enabled: !!coin,
  refetchInterval: 15_000, // re-poll every 15s
  staleTime: 10_000,
});
```

> Note: Hyperliquid's `candleSnapshot` includes the **current, still-open**
> bucket as the last element of the returned array.

### 3.2 Live price (WebSocket)

The live price is the Hyperliquid **mid price**, delivered over a shared
WebSocket subscription (`allMids`) rather than polling:

```ts
// src/features/trade/hyperliquid/services/hyperliquidWebSocket.ts
subscribeHyperliquidMids(listener); // ref-counted, shared socket
```

- A **single** `SubscriptionClient` is shared across the app via ref-counting
  (`retainSocket` / `releaseSocket`); the socket is torn down when the last
  subscriber unsubscribes.
- Mids feed the React Query cache under `hyperliquidQueryKeys.mids()`; the page
  reads them with `useHyperliquidMidPrices({ live: true })` (no polling because
  the WebSocket pushes updates).
- React Strict-Mode double-mount close errors are intentionally swallowed
  (`swallowExpectedClose`).

### 3.3 Header stats (asset context)

The 24h price change shown above the chart is **not** derived from the candle
data. It comes from Hyperliquid's per-asset context (`useHyperliquidAssetContext`):
`prevDayPx`, `dayNtlVlm`, `openInterest`, `funding`. A separate 1h/24h candle
query (`dailyCandlesData`) exists only as a fallback for the previous-day
reference price when `prevDayPx` is unavailable.

---

## 4. Timeframe → interval mapping

The 1H/4H/1D/1W buttons set `windowSecs`, which selects both the candle
`interval` and the historical `lookback`:

| Button | `windowSecs` | Interval | Lookback | Candle width |
| ------ | -----------: | -------- | -------- | -----------: |
| 1H     |        3 600 | `1m`     | 1h       |           60 |
| 4H     |       14 400 | `5m`     | 4h       |          300 |
| 1D     |       86 400 | `15m`    | 24h      |          900 |
| 1W     |      604 800 | `1h`     | 7d       |        3 600 |

Defined in `src/app/(app)/(dashboard)/perps/[coin]/page.tsx` (`candleConfig`)
and mirrored for `candleWidth` inside `LiveChart.tsx`.

The selected window and mode are persisted to `localStorage`:

```ts
// src/stores/useChartSettingsStore.ts  →  key "defuse:chart-settings"
{ mode: "line" | "candle", windowSecs: number }   // defaults: candle, 3600 (1H)
```

---

## 5. Data flow

```
Hyperliquid REST  ──candleSnapshot──▶ getCandleData() ──▶ useHyperliquidCandles
                                                                  │ (15s poll)
Hyperliquid WS  ──allMids──▶ subscribeHyperliquidMids ──▶ useHyperliquidMidPrices
                                                                  │ (live push)
                                                                  ▼
                                          perps/[coin]/page.tsx
                                          • chartData  = candles
                                          • currentPrice = mids[coin]
                                          • entry = open position entryPx
                                                                  ▼
                                              <LiveChart …>  ──▶  <Liveline …>
```

The page assembles three inputs for the chart:

1. **`chartData`** — historical candles (`candles.data`, or `[]` until loaded).
2. **`currentPrice`** — live mid price from the WebSocket.
3. **`entry`** — entry price + `long`/`short` direction, if a position is open.

`LiveChart` then:

- Builds **line data** from candle closes and appends a synthetic point at
  `now` with `currentPrice` so the line tracks the live price.
- Builds **candle data** from OHLC and constructs a separate `liveCandle` at
  `now` from the current price for the in-progress bucket.
- Picks line **color** (green `#00C076` / red `#f43f5e`) from first-vs-last
  value **over the visible window** (so it can differ from the 24h header).
- Decides whether to show the **entry reference line** via
  `isEntryInVisibleRange()` — the line is hidden if it would stretch the
  auto-scaled y-range by more than 50% (`ENTRY_RANGE_SLACK`), keeping the chart
  readable.

---

## 6. Features

- **Two modes** — line (with gradient fill) and candlestick, toggled by a
  button; persisted across sessions.
- **Four time windows** — 1H / 4H / 1D / 1W, each with an appropriate candle
  interval; persisted across sessions.
- **Live price** — pushed over WebSocket and rendered as a moving point/candle,
  a price **badge** (`badgeVariant="minimal"`), and a **pulse** animation; the
  line animates toward new values via `lerpSpeed`.
- **Entry-price overlay** — `Long`/`Short` reference line at the position's
  entry price, auto-hidden when out of the visible range.
- **Momentum shading** and **grid** (built into `liveline`).
- **Adaptive value formatting** — `formatPrice` switches precision by magnitude
  (6 dp under $0.01, 4 dp under $1, otherwise grouped 2 dp).
- **Adaptive time axis** — `formatTime` shows `day month` for the 1W window and
  `HH:mm` (24h) for shorter windows.
- **Dark theme**, sized to a fixed `aspect-263/136` container with a pulsing
  skeleton placeholder while candles load.

### Interaction (mouse / touch)

- **Hover (scrub)** — `scrub` is enabled, so moving the cursor over the chart
  shows a **crosshair and tooltip** with the price/time at that point (liveline
  uses binary-search interpolation for the hover value). The canvas cursor
  defaults to `crosshair`.
- **No zoom, no pan/drag, no scroll-wheel/pinch** — `liveline` exposes none of
  these and there is no API for them. The **only** way to change the visible
  range is the 1H / 4H / 1D / 1W preset buttons. It is a live, scrub-to-inspect
  view, not a pannable/zoomable trading terminal.
- An `onHover` callback (`{ time, value, x, y }`) is available from `liveline`
  but is **not** wired up by `LiveChart` — there is no custom tooltip/readout
  beyond liveline's built-in crosshair.

---

## 7. Key files

| Purpose                            | Path                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| Chart component (liveline wrapper) | `src/features/trade/hyperliquid/components/LiveChart.tsx`         |
| Page integration / data wiring     | `src/app/(app)/(dashboard)/perps/[coin]/page.tsx`                 |
| Candle + mids data service         | `src/features/trade/hyperliquid/services/hyperliquidService.ts`   |
| WebSocket (mids, account state)    | `src/features/trade/hyperliquid/services/hyperliquidWebSocket.ts` |
| React Query hooks                  | `src/features/trade/hyperliquid/hooks/useHyperliquidTradeData.ts` |
| Query keys                         | `src/features/trade/hyperliquid/queries.ts`                       |
| Persisted chart settings           | `src/stores/useChartSettingsStore.ts`                             |

---

## 8. Known limitations / gotchas

- **Skeleton flash on window switch** — changing the timeframe changes the
  React Query key, so `chartData` briefly empties and the loading skeleton
  flashes. Could be smoothed with `placeholderData: keepPreviousData`.
- **Errors render as a permanent loading state** — `chartData` falls back to
  `[]` when the candle `Result` is `ok: false`, so a failed fetch shows the
  skeleton indefinitely with no error/retry UI.
- **In-progress bucket is rendered twice** — `candleSnapshot` already includes
  the open bucket, and `LiveChart` also builds a separate `liveCandle` at `now`;
  verify there's no visual overlap at the right edge in candle mode.
- **Extra always-on candle query** — `dailyCandlesData` (1h / 24h) polls every
  15s but is only a fallback for the previous-day reference price.
- **Line color vs header color** — the line's green/red reflects the selected
  window, while the header %change is 24h; they can disagree.
- **Entry-visibility check ignores wicks** — `isEntryInVisibleRange` scans close
  values only, so in candle mode the entry line can be hidden even when it sits
  within the candle high/low range.
