export const WALLET_REMOTE_NAME = 'mfe-wallets';

export const WALLET_REMOTE_EXPOSED_MODULES = {
  mount: './mount',
  authProvider: './auth-provider',
  privyProvider: './providers/privy',
} as const;

export type WalletRemoteExposedModule =
  (typeof WALLET_REMOTE_EXPOSED_MODULES)[keyof typeof WALLET_REMOTE_EXPOSED_MODULES];
