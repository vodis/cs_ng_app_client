import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import { Observable, from, map, switchMap, throwError } from 'rxjs';
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
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authProvider: AuthProviderService
  ) {}

  loadBalances(params?: {
    walletAddress?: string;
    network?: string;
    assetId?: string;
  }): Observable<WalletBalance[]> {
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
      map(response => response.data ?? [])
    );
  }
}
