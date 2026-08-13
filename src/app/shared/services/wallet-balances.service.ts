import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type WalletBalance = {
  walletId: string;
  walletAddress: string;
  chainType: string;
  assetId: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balanceDecimal?: string | null;
  source: string;
  fetchedAt: string;
  expiresAt: string;
};

type WalletBalancesResponse = {
  data?: WalletBalance[];
};

@Injectable({
  providedIn: 'root',
})
export class WalletBalancesService {
  constructor(private readonly httpClient: HttpClient) {}

  loadBalances(params?: {
    walletAddress?: string;
    network?: string;
    assetId?: string;
  }): Observable<WalletBalance[]> {
    return this.httpClient
      .post<WalletBalancesResponse>(
        `${environment.apiUrl}/api/v1/balances`,
        params ?? {}
      )
      .pipe(map(response => response.data ?? []));
  }
}
