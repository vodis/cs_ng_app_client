import type { PrivyBridgeUser, PrivyEmbeddedWallet } from '@core/privy/privy-bridge.types';

export type BackendUser = {
  id: string;
  privyUserId: string;
  sessionId: string;
  email?: string | null;
  authMethod?: string | null;
};

export type BackendWallet = {
  id: string;
  privyWalletId: string;
  address: string;
  chainType: string;
  walletType: string;
  isPrimary: boolean;
};

export type AuthSession = {
  user: BackendUser;
  wallets: BackendWallet[];
};

export type LoginMethod = 'email' | 'google' | 'apple' | 'passkey';

export type PrivySessionRequest = {
  email?: string;
  authMethod?: string;
  wallet?: {
    privyWalletId?: string;
    address: string;
    chainType?: string;
    walletType?: string;
    isPrimary?: boolean;
  };
};

export function emailFromPrivyUser(user: PrivyBridgeUser | null | void): string | undefined {
  return user?.email?.address || undefined;
}

export function walletFromPrivyWallet(wallet: PrivyEmbeddedWallet | null): PrivySessionRequest['wallet'] {
  if (!wallet?.address) {
    return undefined;
  }

  return {
    privyWalletId: wallet.id,
    address: wallet.address,
    chainType: wallet.chainType || 'ethereum',
    walletType: wallet.walletClientType || 'embedded',
    isPrimary: true,
  };
}
