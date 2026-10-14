export interface AssetDto {
  assetId: string;
  balanceAssetId?: string;
  sourceNetwork?: string;
  defuseAssetId?: string;
  symbol: string;
  name?: string;
  icon?: string;
  decimals?: number;
  blockchain?: string;
  contractAddress?: string;
  price?: string | number;
  priceUpdatedAt?: string;
}

export interface AssetsApiResponse {
  data: AssetDto[];
}
