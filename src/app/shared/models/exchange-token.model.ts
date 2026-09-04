export interface ExchangeToken {
  symbol: string;
  displaySymbol?: string;
  name: string;
  assetId: string;
  color: string;
  icon?: string;
  decimals?: number;
  blockchain: string;
  contractAddress?: string;
}
