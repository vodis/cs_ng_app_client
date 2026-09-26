import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  emptyMarketSnapshot,
  type WalletMarketSnapshot,
} from '@shared/utils/market-display.util';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

const maxSymbolsPerRequest = 30;

type MarketSnapshotsResponse = {
  data?: unknown;
};

@Injectable({
  providedIn: 'root',
})
export class MarketSnapshotsService {
  constructor(private readonly httpClient: HttpClient) {}

  load(symbols: string[]): Observable<WalletMarketSnapshot[]> {
    const requested = [
      ...new Set(
        symbols
          .map(symbol => symbol.trim().toUpperCase())
          .filter(symbol => symbol.length > 0)
      ),
    ];
    if (requested.length === 0) {
      return of([]);
    }

    const batches: string[][] = [];
    for (
      let index = 0;
      index < requested.length;
      index += maxSymbolsPerRequest
    ) {
      batches.push(requested.slice(index, index + maxSymbolsPerRequest));
    }

    return forkJoin(batches.map(batch => this.loadBatch(batch))).pipe(
      map(results => results.flat())
    );
  }

  private loadBatch(symbols: string[]): Observable<WalletMarketSnapshot[]> {
    return this.httpClient
      .get<MarketSnapshotsResponse>(
        `${environment.apiUrl}/api/v1/markets/snapshots`,
        { params: { symbols: symbols.join(',') } }
      )
      .pipe(
        map(response => this.parse(response, symbols)),
        catchError(() => of(symbols.map(symbol => emptyMarketSnapshot(symbol))))
      );
  }

  private parse(
    response: MarketSnapshotsResponse,
    symbols: string[]
  ): WalletMarketSnapshot[] {
    if (!Array.isArray(response?.data)) {
      throw new Error('Market snapshot response is invalid');
    }

    const bySymbol = new Map<string, WalletMarketSnapshot>();
    for (const item of response.data) {
      const snapshot = this.parseSnapshot(item);
      if (snapshot) {
        bySymbol.set(snapshot.symbol, snapshot);
      }
    }

    return symbols.map(
      symbol => bySymbol.get(symbol) ?? emptyMarketSnapshot(symbol)
    );
  }

  private parseSnapshot(value: unknown): WalletMarketSnapshot | undefined {
    if (!this.isRecord(value) || typeof value['symbol'] !== 'string') {
      return undefined;
    }

    const sparkline = Array.isArray(value['sparkline7d'])
      ? value['sparkline7d'].filter(
          (point): point is number =>
            typeof point === 'number' && Number.isFinite(point)
        )
      : [];

    return {
      symbol: value['symbol'].trim().toUpperCase(),
      priceUsd: this.numberOrZero(value['priceUsd']),
      change24hPercent: this.numberOrZero(value['change24hPercent']),
      marketCapUsd: this.numberOrZero(value['marketCapUsd']),
      volume24hUsd: this.numberOrZero(value['volume24hUsd']),
      sparkline7d: sparkline.length >= 2 ? sparkline : [0, 0],
    };
  }

  private numberOrZero(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
