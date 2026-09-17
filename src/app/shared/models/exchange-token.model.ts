export interface ExchangeToken {
  symbol: string;
  displaySymbol?: string;
  name: string;
  assetId: string;
  /** Provider/BFF identifier used for quote and execution requests. */
  executionAssetId?: string;
  color: string;
  icon?: string;
  decimals?: number;
  blockchain: string;
  contractAddress?: string;
}
