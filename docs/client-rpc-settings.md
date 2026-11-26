# Client RPC settings

Browser-only RPC preferences for the CraftScript host shell. Users can pick a
default, preset, or custom HTTP(S) endpoint per network. Choices stay in
`localStorage` and are never sent to CraftScript backends.

## Ownership

| Concern | Owner |
| --- | --- |
| Preference storage + health probes + settings UI | Host (`cs_ng_app_client`) |
| Authenticated balances / quotes / execution RPC | NestJS BFF (private) |
| Wallet connect / sign / send | `mfe-wallets` |

Custom RPC URLs must **not** be forwarded to the BFF. Server-side market and
balance reads continue to use backend-owned RPC. Host `ClientRpcFacade.effectiveUrl()`
is the source of truth for any future **browser-side** JSON-RPC work (probes
today).

## Storage

- Key: `app:v1:client-rpc-preferences`
- Shape: `{ version: 1, networks: Record<RpcNetworkId, RpcEndpointChoice> }`
- Scope: `localStorage` via `StorageService` (non-sensitive preference)

## Health thresholds

| Level | Rule |
| --- | --- |
| Healthy | probe OK and latency `< 800ms` |
| Slow | probe OK and latency `< 2500ms` |
| Failing | probe error, timeout (`5s`), latency `≥ 2500ms`, or EVM `eth_chainId` mismatch |

Status polling runs about every 30s for the active-wallet network (mapped via
`resolveRpcNetworkId`). The menu status dot uses that active network (`status$`);
the settings drawer status row uses the network selected in the panel
(`selectedStatus$`).

## Fallback behaviour

1. Probe the preferred endpoint (default / preset / custom).
2. On failure of a non-default choice, probe the network default and mark
   `usingFallback: true`.
3. Keep the saved custom/preset URL so the user can fix it in settings.
4. Status dot shows **Failing** while fallback is active.
5. In-flight probe results apply only if the preferred URL is still the same
   choice that started the check (generation + URL). Saving a new custom URL
   bumps the generation so a stale failure cannot force fallback, and the new
   URL is probed immediately.

## UI entry points

- Mobile menu footer: `app-rpc-status-dot` (hover/focus popup + click opens
  settings).
- Settings surface: second `app-side-modal` hosting `app-rpc-settings-panel`.

Desktop rail placement is intentionally out of scope for the first ship.

## Code map

- Domain: `src/app/domains/rpc/`
- Status dot: `src/app/shared/components/rpc-status-dot/`
- Settings panel: `src/app/shared/components/rpc-settings-panel/`
- Menu wiring: `src/app/components/mobile-bottom-nav/`
