import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import {
  Observable,
  concatMap,
  from,
  map,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';
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

export type WalletBalancesResult = {
  balances: WalletBalance[];
  partial: boolean;
  errorMessages?: string[];
};

type WalletBalancesResponse = {
  data?: unknown;
  meta?: unknown;
};

const BALANCE_ASSET_BATCH_SIZE = 20;

@Injectable({
  providedIn: 'root',
})
export class WalletBalancesService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly authProvider: AuthProviderService
  ) {}

  loadBalances(params?: WalletBalancesRequest): Observable<WalletBalance[]> {
    const requests = this.balanceRequests(params);
    return from(requests).pipe(
      concatMap(request =>
        this.loadBalancesWithMeta(request).pipe(
          map(result => {
            if (result.partial) {
              throw new Error('Wallet balance response is incomplete');
            }
            return result.balances;
          })
        )
      ),
      toArray(),
      map(results => results.flat())
    );
  }

  loadBalancesWithMeta(
    params?: WalletBalancesRequest
  ): Observable<WalletBalancesResult> {
    return from(this.authProvider.whenSettled()).pipe(
      switchMap(() => this.authProvider.getAccessToken()),
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
      map(response => ({
        balances: this.parseBalances(response.data),
        partial: this.parsePartial(response.meta),
        errorMessages: this.parseIssueMessages(response.meta),
      }))
    );
  }

  private parseIssueMessages(value: unknown): string[] {
    if (!this.isRecord(value) || !Array.isArray(value['issues'])) return [];
    const messages: Record<string, string> = {
      RPC_RATE_LIMITED:
        'The balance provider is rate limiting requests. Try again shortly.',
      RPC_TIMEOUT: 'The balance provider timed out. Try again shortly.',
      RPC_NOT_CONFIGURED:
        'Balance access is not configured for one or more networks.',
      RPC_UNAVAILABLE: 'The balance provider is temporarily unavailable.',
      BALANCE_READ_FAILED:
        'Some token balances could not be read from the provider.',
    };
    const details = value['issues'].flatMap((issue: unknown) => {
      if (!this.isRecord(issue) || typeof issue['code'] !== 'string') return [];
      return Object.prototype.hasOwnProperty.call(messages, issue['code'])
        ? [messages[issue['code']]]
        : [];
    });
    return [...new Set(details)];
  }

  private parsePartial(value: unknown): boolean {
    if (value === undefined) {
      return false;
    }
    if (!this.isRecord(value) || typeof value['partial'] !== 'boolean') {
      throw new Error('Balance response metadata is invalid');
    }
    return value['partial'];
  }

  private balanceRequests(
    params?: WalletBalancesRequest
  ): Array<WalletBalancesRequest | undefined> {
    const assetIds = params?.assetIds;
    if (!assetIds || assetIds.length <= BALANCE_ASSET_BATCH_SIZE) {
      return [params];
    }

    const uniqueAssetIds = [...new Set(assetIds)];
    const requests: WalletBalancesRequest[] = [];
    for (
      let index = 0;
      index < uniqueAssetIds.length;
      index += BALANCE_ASSET_BATCH_SIZE
    ) {
      requests.push({
        ...params,
        assetIds: uniqueAssetIds.slice(index, index + BALANCE_ASSET_BATCH_SIZE),
      });
    }
    return requests;
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
