import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import { Observable, from, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type WalletBalance = {
  walletId: string | null;
  walletAddress: string;
  chainType: string;
  network: string;
  assetId: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balanceDecimal?: string | null;
  source: string;
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
};

export type WalletBalancesRequest = {
  walletAddress?: string;
  network?: string;
  assetId?: string;
  assetIds?: string[];
};

type WalletBalancesResponse = {
  data?: unknown;
};

@Injectable({
  providedIn: 'root',
})
export class WalletBalancesService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authProvider: AuthProviderService
  ) {}

  loadBalances(params?: WalletBalancesRequest): Observable<WalletBalance[]> {
    return from(this.authProvider.getAccessToken()).pipe(
      switchMap(token => {
        if (!token) {
          return throwError(() => new Error('No active session'));
        }

        return this.httpClient.post<WalletBalancesResponse>(
          `${environment.apiUrl}/api/v1/balances`,
          params ?? {},
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          }
        );
      }),
      map(response => this.parseBalances(response.data))
    );
  }

  private parseBalances(value: unknown): WalletBalance[] {
    if (!Array.isArray(value)) {
      throw new Error('Balance response is invalid');
    }
    return value.map(item => this.parseBalance(item));
  }

  private parseBalance(value: unknown): WalletBalance {
    if (!this.isRecord(value)) {
      throw new Error('Balance row is invalid');
    }

    const walletId = value['walletId'];
    const balanceDecimal = value['balanceDecimal'];
    const requiredStrings = [
      'walletAddress',
      'chainType',
      'network',
      'assetId',
      'symbol',
      'balanceRaw',
      'source',
      'fetchedAt',
      'expiresAt',
    ] as const;

    if (
      !(walletId === null || typeof walletId === 'string') ||
      !requiredStrings.every(key => typeof value[key] === 'string') ||
      typeof value['decimals'] !== 'number' ||
      !Number.isFinite(value['decimals']) ||
      !(balanceDecimal === null || typeof balanceDecimal === 'string') ||
      typeof value['stale'] !== 'boolean'
    ) {
      throw new Error('Balance row is invalid');
    }

    return {
      walletId: walletId as string | null,
      walletAddress: value['walletAddress'] as string,
      chainType: value['chainType'] as string,
      network: value['network'] as string,
      assetId: value['assetId'] as string,
      symbol: value['symbol'] as string,
      decimals: value['decimals'] as number,
      balanceRaw: value['balanceRaw'] as string,
      balanceDecimal: balanceDecimal as string | null,
      source: value['source'] as string,
      fetchedAt: value['fetchedAt'] as string,
      expiresAt: value['expiresAt'] as string,
      stale: value['stale'],
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
