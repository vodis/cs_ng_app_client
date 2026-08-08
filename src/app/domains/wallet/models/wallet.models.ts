export interface WalletAccount {
  account: string;
  chainId: number | null;
}

export type LastConnectedWallet = {
  account: string;
  chainId: number | null;
  walletType: 'embedded' | 'external';
  source?: string;
  connectorId?: string;
};
