export type WalletBalancesStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unavailable';

export type WalletBalanceRow = {
  walletAddress: string;
  chainType: 'ethereum';
  network: string;
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

export type WalletBalancesSnapshot = {
  status: WalletBalancesStatus;
  account: string | null;
  chainId: number | null;
  rows: WalletBalanceRow[];
  errorMessage?: string;
};

export const IDLE_WALLET_BALANCES_SNAPSHOT: WalletBalancesSnapshot = {
  status: 'idle',
  account: null,
  chainId: null,
  rows: [],
};

export const EVM_BALANCE_NETWORKS = [
  { chainId: 1, name: 'Ethereum', shortName: 'ETH' },
  { chainId: 42161, name: 'Arbitrum', shortName: 'ARB' },
  { chainId: 8453, name: 'Base', shortName: 'BASE' },
  { chainId: 137, name: 'Polygon', shortName: 'POL' },
] as const;
