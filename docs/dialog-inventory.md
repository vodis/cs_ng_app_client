# Dialog inventory (host)

Audit of overlays / dialogs in `cs_ng_app_client` after the swap-flow side-slide
migration. Goal: one shared pattern (`app-side-modal`) instead of one-off
centered modals.

Code-traced on `develop` (branch `feat/side-slide-remaining-modals`). Staging
UI was not browser-verified here (staging returns 401 without credentials).

## Ticket targets

| Dialog | Status | Notes |
| --- | --- | --- |
| **Add Funds** | Already side slide | `ProfileComponent` → `app-side-modal` (`size="compact"`) + `app-add-funds-panel`. Shipped in #237. |
| **Manage wallet(s)** | Already side slide / removed | Dedicated **Manage wallets** dialog removed in #235 (inline row actions). Connect / active-wallet board / swap-review open via root `<app-wallet-bar [hostModal]="true">` → `app-side-modal` + MFE / `app-connected-wallet-board`. |

No further host migration is required for those two flows.

## Host dialogs already on `app-side-modal`

| Surface | Opener | Content |
| --- | --- | --- |
| Token select | Exchange (home) | `app-token-select-panel` |
| Cross-network recipient | Exchange | `app-recipient-address-panel` |
| Swap settings | Exchange | `@vodis/cs-ui` `cs-swap-settings` (#255) |
| Swap review / connect / wallet board | Shell `app-wallet-bar` | MFE mount + connected board |
| Add Funds | Profile | `app-add-funds-panel` |
| Investment preferences | Portfolio | Inline portfolio form |
| Connect AI agent | Portfolio | Inline portfolio form |
| Email OTP verify | Login / Register | Code form |

Host has **no** `MatDialog` / CDK `Overlay` centered dialogs.

## Related non-modal overlays (keep as-is unless product asks)

| Surface | Pattern | Notes |
| --- | --- | --- |
| Mobile main nav | Custom slide-in (`mobile-bottom-nav`) | Full-height left/edge panel, not `app-side-modal` |
| Profile Activity month/year | Anchored dropdown | Not a modal |
| Auth pages `register-shell--centered` | Page layout | Not a dialog |

## Follow-ups (not in this host PR)

Post these for product / MFE decisions:

1. **Wallet pairing QR** (`cs_mfe-wallets` `WalletPairingModal`) — centered card *inside* the wallet drawer (`.wallets-mfe__modal`). Candidate to become a nested slide step or full drawer content.
2. **Third-party wallet UIs** — TonConnect `openModal`, WalletConnect / Privy provider sheets. Owned by SDKs; cannot fully restyle to CraftScript side slide.
3. **Send Funds** — still **Soon** on Profile; when built, open it with `app-side-modal` (same as Add Funds).
4. **Confirm swap** — already hosted in the wallet side drawer (`drawerMode === 'swap-review'`); keep that contract, do not reintroduce a centered overlay.

## Rule of thumb for new UI

- Prefer `app-side-modal` (optionally `size="compact"`) for any blocking host dialog.
- Put wallet-domain chrome in the existing `hostModal` drawer; do not add a second overlay stack.
- Document Level 1 mount / close behaviour when MFE content owns the drawer.
