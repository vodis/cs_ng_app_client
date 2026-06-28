import type {
  AuthProviderUser,
  AuthProviderWallet,
} from './auth-provider.gateway';

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
  source?: string;
  status?: string;
  isPrimary: boolean;
  deletedAt?: string | null;
};

export type BackendBalance = {
  walletId: string;
  walletAddress: string;
  chainType: string;
  assetId: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balanceDecimal?: string | null;
  source: string;
  fetchedAt: string;
  expiresAt: string;
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
    source?: string;
    isPrimary?: boolean;
  };
};

export function emailFromAuthProviderUser(
  user: AuthProviderUser | null | void
): string | undefined {
  return user?.email?.address || undefined;
}

export function walletFromAuthProvider(
  wallet: AuthProviderWallet | null
): PrivySessionRequest['wallet'] {
  if (!wallet?.address) {
    return undefined;
  }

  return {
    privyWalletId: wallet.id,
    address: wallet.address,
    chainType: wallet.chainType || 'ethereum',
    walletType: wallet.walletClientType || 'embedded',
    source: 'privy',
    isPrimary: true,
  };
}
