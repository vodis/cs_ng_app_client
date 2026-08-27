export const WALLET_REMOTE_NAME = 'mfe-wallets';
export const WALLET_REMOTE_ENTRY_FILE = 'remoteEntry.js';

export const WALLET_REMOTE_EXPOSED_MODULES = {
  mount: './mount',
  authProvider: './auth-provider',
  privyProvider: './providers/privy',
} as const;

export type WalletRemoteExposedModule =
  (typeof WALLET_REMOTE_EXPOSED_MODULES)[keyof typeof WALLET_REMOTE_EXPOSED_MODULES];

/**
 * `environment.mfeWalletsRemoteUrl` is the remote origin only.
 * Federation always loads `remoteEntry.js` from that origin.
 */
export function resolveWalletRemoteEntryUrl(remoteOrigin: string): string {
  const origin = remoteOrigin.trim().replace(/\/+$/, '');
  if (origin.endsWith(`/${WALLET_REMOTE_ENTRY_FILE}`)) {
    return origin;
  }
  return `${origin}/${WALLET_REMOTE_ENTRY_FILE}`;
}
