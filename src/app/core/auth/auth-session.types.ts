export type BackendUser = {
  id: string;
  providerUserId: string;
  sessionId: string;
  email?: string | null;
  authMethod?: string | null;
  passkeyEnabled?: boolean;
};

export type BackendWallet = {
  id: string;
  providerWalletId: string;
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
  network: string;
  assetId: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balanceDecimal?: string | null;
  source: string;
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
};

export type AuthSession = {
  user: BackendUser;
  wallets: BackendWallet[];
};

export type LoginMethod = 'email' | 'google' | 'apple' | 'passkey';
