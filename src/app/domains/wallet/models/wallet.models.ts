export interface WalletAccount {
  account: string;
  chainId: number | null;
  identity?: {
    connectorId: string;
    address: string;
    chainType: 'ethereum' | 'near' | 'ton';
    walletType: 'embedded' | 'external';
  } | null;
}

export type LastConnectedWallet = {
  account: string;
  chainId: number | null;
  walletType: 'embedded' | 'external';
  source?: string;
  connectorId?: string;
};
