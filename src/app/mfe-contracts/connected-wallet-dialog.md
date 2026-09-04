# Connected wallet dialog — host wiring sketch (internal)

This is **not** the agent source of truth.

- Decision: `cs_mfe-wallets/AGENT_GUIDE.md` → **Gateway boundary**
- Architecture: `cs_mfe-wallets/ARCHITECTURE.md` → **Gateway vs host product UI**

Canonical copy of this sketch: `cs_mfe-wallets/src/contracts/connected-wallet-dialog.md`.
Keep this file in sync. If it disagrees with `AGENT_GUIDE.md`, the agent guide wins.

---

Angular builds the connected-wallet **board**. `mfe-wallets` stays the **gateway**.
The NestJS BFF owns the numbers.

If the gateway is not connected, Angular must not show a balance.

This replaces the Mock balances table currently rendered inside the MFE
connected sheet. That table is a labeled fixture, not the production UI.

---

## Ownership (one line each)

| Piece | Owner |
| --- | --- |
| Connect picker (NEAR / MetaMask / Passkey / grid) | MFE `./mount` |
| Live wallet session (connect, disconnect, snapshot) | MFE `walletGatewayMachine` |
| When balances may exist | MFE gateway (`connected` → `SYNC_BALANCES`) |
| RPC / asset ids / decimals / freshness | NestJS `POST /api/v1/balances` |
| Connected board UI (address, network chips, rows) | Angular host |
| Price, market cap, volume, 7d sparkline | **Out of v1.** Do not copy the Mock columns until `/markets` exists. |

Keep `app-wallets` **mounted** while the board is open. Unmounting the MFE
kills the gateway; the board must then go empty.

---

## What Angular should draw (v1, EVM only)

Same side-modal as today (`app-side-modal` wrapping the wallet flow).

**While snapshot is not `connected`:** show the MFE connect picker (`<app-wallets />`).

**While snapshot is `connected` and `identity.chainType === 'ethereum'`:** hide the
picker visually (do not unmount) and show an Angular panel with:

1. **Connected wallet** — truncated `account`, meta `{network name} / {walletType}`
2. **Network** — chips ETH `1`, ARB `42161`, BASE `8453`, POL `137`
3. **Balances** — total amount when it can be summed from rows; list of
   `symbol` + `balanceDecimal` (or formatted `balanceRaw`); loading / empty / error
4. **Activity** / **Send & receive** — keep as host `Soon` placeholders, or omit
5. **Disconnect** — calls MFE `disconnectWallet()`, then hide the board

**While connected but not EVM (NEAR / TON):** show address + disconnect only.
Do not call balances. Empty copy: balances for this network are not available yet.

Do not render Mock ETH/USDC/WETH, fake USD totals, or a Mock badge.

---

## Communication

Existing mount stays as-is. Add one outbound event and one inbound gateway event.
Bump mount contract to `2.1.0`.

### Host already has

- `mountApi.subscribe(event => …)` and `WalletGatewayBridgeService.snapshot$`
- `getSnapshot()`, `disconnectWallet()`, `sendGatewayEvent({ type: 'RESET' })`

### Add — MFE → host

```ts
{ type: 'balances.updated'; payload: WalletBalancesSnapshot }
```

```ts
type WalletBalanceRow = {
  walletAddress: string;
  chainType: 'ethereum';
  network: string;      // CAIP-2, e.g. 'eip155:1'
  chainId: number;
  assetId: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balanceDecimal: string | null;
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
};

type WalletBalancesSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  account: string | null;
  chainId: number | null;
  rows: WalletBalanceRow[];
  errorMessage?: string;
};
```

`unavailable` = not EVM, or no auth token for the BFF.
`idle` = no live gateway account (disconnected / reset / MFE gone).

### Add — host → MFE

```ts
{ type: 'BALANCES_SYNC_REQUESTED'; chainId?: number }
```

Use this when the user taps a network chip. Omit `chainId` to refresh the
current chain.

Do not add a host HTTP call for this dialog. Exchange-page `WalletBalancesService`
stays for swap quotes; this board is gateway-sourced.

---

## Flow

```text
1. User clicks Connect wallet
      Host opens app-side-modal
      Host keeps <app-wallets> mounted

2. User picks a wallet in the MFE
      MFE connector connects
      Gateway → status: connected
      Host receives connection.snapshot.updated

3. Host reads snapshot
      if status !== 'connected'     → hide board, show picker, rows = []
      if chainType !== 'ethereum'   → show address + disconnect only
      if chainType === 'ethereum'   → show Angular board (loading)

4. Gateway (automatic on connected)
      abstractBalance → POST /api/v1/balances
        { walletAddress, network: 'eip155:{chainId}' }
      Bearer token from auth-provider
      emit balances.updated { status: 'ready' | 'error' | 'unavailable', rows }

5. Host renders payload.rows
      stale/expired rows may be shown as stale; they must not look like Mock data
      empty ready → "No balances yet" (real empty, not a fixture)

6. User taps ARB / BASE / POL
      Host sendGatewayEvent({ type: 'BALANCES_SYNC_REQUESTED', chainId })
      Host sets board to loading
      Gateway fetches that eip155 network and emits balances.updated

7. User taps Disconnect (or modal close)
      Host mountApi.disconnectWallet() and/or sendGatewayEvent({ type: 'RESET' })
      Host receives wallet.disconnected / snapshot status disconnected
      Host clears rows and shows the connect picker again
```

### Host subscription (canonical)

```ts
mountApi.subscribe((event) => {
  if (event.type === 'connection.snapshot.updated') {
    applyConnection(event.payload); // open/hide board, never fetch here
  }
  if (event.type === 'balances.updated') {
    applyBalances(event.payload);   // the only place rows are set
  }
});
```

On MFE unmount / load failure: `applyBalances({ status: 'idle', account: null, chainId: null, rows: [] })`.

---

## MFE work

1. Stop rendering Mock balances / market columns / Mock badge in
   `ConnectedWalletPanel`. Keep a thin “connected” confirmation only if the
   picker still needs a post-connect state; the board itself moves to Angular.
2. Implement `abstract-balance.machine.ts` fetch for **EVM only**:
   `POST {apiBaseUrl}/api/v1/balances` with session token.
   Non-EVM → snapshot `unavailable`, `rows: []`.
   Missing token → `unavailable` (do not invent zeros).
3. On `connected` entry, keep existing `syncBalancesForAccount`.
4. Handle `BALANCES_SYNC_REQUESTED`.
5. On `RESET` / disconnect, emit `balances.updated` with `status: 'idle'` and
   empty rows.
6. Emit `balances.updated` with `loading` before each fetch.

Connectors stay connect/sign/send. No `eth_getBalance`.

---

## Angular work

1. Mirror `WalletBalancesSnapshot` + `balances.updated` +
   `BALANCES_SYNC_REQUESTED` in `src/app/mfe-contracts/`.
2. `WalletGatewayBridgeService`: hold latest balances snapshot; clear it when
   connection snapshot is not `connected` or when mount API is cleared.
3. New presentational panel in the wallet side-modal (same visual stack as the
   current Mock board: connected + network + balances + disconnect).
4. `wallet-bar`: if `snapshot.status === 'connected'` show the Angular panel;
   else show `<app-wallets />`. MFE host node stays in the DOM.
5. Disconnect button → `disconnectWallet()`.
6. Network chips → `BALANCES_SYNC_REQUESTED` with that `chainId`.
7. Tests: connected EVM paints rows from `balances.updated`; disconnect clears
   the board; NEAR connected does not fetch; MFE unmount clears the board.

---

## Build order

1. **Contract** in both repos (types + event names). Host can compile the panel
   against fixtures.
2. **MFE gateway fetch + events** (EVM only). Verify with the standalone
   remote that `balances.updated` fires after MetaMask/Privy connect.
3. **Angular board** subscribed to those events. Delete MFE Mock UI in the same
   PR train so the two UIs never both show a portfolio.

v1 is complete when an EVM connect shows BFF amounts in the Angular modal, and
disconnect/MFE-down shows nothing.

---

## Do not

- Call `POST /api/v1/balances` from the profile session or this dialog without
  a live gateway snapshot.
- Keep the MFE Mock table as a fallback when the BFF returns empty.
- Unmount `app-wallets` while the connected board is visible.
- Treat price / market cap / volume / sparkline as part of this slice.
