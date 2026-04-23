export const WALLET_EVENTS = {
  connected: 'wallet.connected',
  disconnected: 'wallet.disconnected',
  accountChanged: 'wallet.accountChanged',
  chainChanged: 'wallet.chainChanged',
  txSigned: 'wallet.txSigned',
  error: 'wallet.error',
} as const;

export type WalletEventName =
  (typeof WALLET_EVENTS)[keyof typeof WALLET_EVENTS];
