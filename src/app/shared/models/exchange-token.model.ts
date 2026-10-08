export interface ExchangeToken {
  symbol: string;
  displaySymbol?: string;
  name: string;
  assetId: string;
  balanceAssetId?: string;
  /** Provider/BFF identifier used for quote and execution requests. */
  executionAssetId?: string;
  color: string;
  icon?: string;
  decimals?: number;
  blockchain: string;
  contractAddress?: string;
  priceUsd?: string | number;
  priceUpdatedAt?: string;
}
