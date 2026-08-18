import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AssetDto, AssetsApiResponse } from '@shared/models/asset.model';
import { ExchangeToken } from '@shared/models/exchange-token.model';

const TOKEN_COLORS: Record<string, string> = {
  USDC: '#2f8cff',
  USDT: '#26a17b',
  ETH: '#627eea',
  NEAR: '#2fd17c',
  wNEAR: '#2fd17c',
  BTC: '#f7931a',
  wBTC: '#f7931a',
  SOL: '#9945ff',
  FRAX: '#000000',
  AURORA: '#70d44b',
};

@Injectable({
  providedIn: 'root',
})
export class ExchangeAssetsService {
  constructor(private readonly httpClient: HttpClient) {}

  public loadAssets(): Observable<ExchangeToken[]> {
    return this.httpClient
      .get<AssetsApiResponse>(`${environment.apiUrl}/api/v1/assets`)
      .pipe(
        map(response => {
          const assets = response.data ?? [];
          return assets
            .map(asset => this.mapAssetToExchangeToken(asset))
            .sort(
              (left, right) =>
                left.symbol.localeCompare(right.symbol) ||
                left.blockchain.localeCompare(right.blockchain)
            );
        })
      );
  }

  private mapAssetToExchangeToken(asset: AssetDto): ExchangeToken {
    return {
      assetId: asset.assetId,
      symbol: asset.symbol,
      displaySymbol: this.displaySymbolFor(asset.symbol),
      name: asset.name?.trim() || asset.symbol,
      icon: asset.icon,
      decimals: asset.decimals,
      blockchain: asset.blockchain?.trim().toLowerCase() || 'unknown',
      color: this.colorForSymbol(asset.symbol),
    };
  }

  private displaySymbolFor(symbol: string): string {
    if (symbol === 'wNEAR') {
      return 'NEAR';
    }

    if (symbol === 'wBTC') {
      return 'BTC';
    }

    return symbol;
  }

  private colorForSymbol(symbol: string): string {
    const knownColor = TOKEN_COLORS[symbol];
    if (knownColor) {
      return knownColor;
    }

    let hash = 0;
    for (let index = 0; index < symbol.length; index += 1) {
      hash = symbol.charCodeAt(index) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 58% 46%)`;
  }
}
