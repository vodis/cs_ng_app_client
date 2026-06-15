export interface AssetDto {
  assetId: string;
  defuseAssetId?: string;
  symbol: string;
  name?: string;
  icon?: string;
  decimals?: number;
  blockchain?: string;
  contractAddress?: string;
  price?: number;
  priceUpdatedAt?: string;
}

export interface AssetsApiResponse {
  data: AssetDto[];
}
