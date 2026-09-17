import { Injectable } from '@angular/core';
import { ExchangeAssetsService } from '@shared/services/exchange-assets.service';
import {
  WalletBalance,
  WalletBalancesResult,
  WalletBalancesService,
} from '@shared/services/wallet-balances.service';
import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';

const MAX_BALANCE_ASSETS_PER_REQUEST = 20;

const BLOCKCHAIN_BY_NETWORK: Readonly<Record<string, string>> = {
  'eip155:1': 'eth',
  'eip155:10': 'op',
  'eip155:56': 'bsc',
  'eip155:100': 'gnosis',
  'eip155:137': 'pol',
  'eip155:8453': 'base',
  'eip155:42161': 'arb',
  'eip155:43114': 'avax',
  'eip155:534352': 'scroll',
  'near:mainnet': 'near',
  'near:testnet': 'near',
  'ton:mainnet': 'ton',
  'ton:testnet': 'ton',
};

const NATIVE_SYMBOL_BY_BLOCKCHAIN: Readonly<Record<string, string>> = {
  arb: 'ETH',
  avax: 'AVAX',
  base: 'ETH',
  bsc: 'BNB',
  eth: 'ETH',
  gnosis: 'XDAI',
  op: 'ETH',
  pol: 'POL',
  scroll: 'ETH',
  ton: 'TON',
  near: 'NEAR',
};

export type ConnectedWalletBalancesState = {
  status: 'loading' | 'ready' | 'partial' | 'error';
  account: string;
  network: string;
  rows: WalletBalance[];
  errorMessage?: string;
};

export type ConnectedWalletBalancesRequest = {
  account: string;
  network: string;
};

@Injectable({ providedIn: 'root' })
export class ConnectedWalletBalancesFacade {
  constructor(
    private readonly assets: ExchangeAssetsService,
    private readonly balances: WalletBalancesService
  ) {}

  load(
    request: ConnectedWalletBalancesRequest
  ): Observable<ConnectedWalletBalancesState> {
    const account = request.account.trim();
    const blockchain = BLOCKCHAIN_BY_NETWORK[request.network];

    if (!account || !blockchain) {
      return of({
        status: 'error',
        account,
        network: request.network,
        rows: [],
        errorMessage: 'Balances for this network are not available yet.',
      });
    }

    return this.assets.loadAssets().pipe(
      map(tokens =>
        tokens
          .filter(
            token =>
              token.blockchain === blockchain &&
              token.symbol.toUpperCase() !==
                NATIVE_SYMBOL_BY_BLOCKCHAIN[blockchain] &&
              (blockchain === 'near'
                ? token.assetId.startsWith('nep141:')
                : Boolean(token.contractAddress))
          )
          .map(token => token.assetId)
          .filter(assetId => assetId.trim().length > 0)
      ),
      switchMap(assetIds => {
        const uniqueAssetIds = [...new Set(assetIds)];
        const requests: Observable<WalletBalancesResult>[] = [
          this.balances.loadBalancesWithMeta({
            walletAddress: account,
            network: request.network,
          }),
        ];

        for (
          let index = 0;
          index < uniqueAssetIds.length;
          index += MAX_BALANCE_ASSETS_PER_REQUEST
        ) {
          requests.push(
            this.balances.loadBalancesWithMeta({
              walletAddress: account,
              network: request.network,
              assetIds: uniqueAssetIds.slice(
                index,
                index + MAX_BALANCE_ASSETS_PER_REQUEST
              ),
            })
          );
        }

        return forkJoin(requests);
      }),
      map(resultSets => {
        const byAsset = new Map<string, WalletBalance>();
        for (const result of resultSets) {
          for (const balance of result.balances) {
            if (!this.matchesRequest(balance, account, request.network)) {
              throw new Error('Balance response provenance does not match');
            }
            byAsset.set(balance.assetId, balance);
          }
        }
        const partial = resultSets.some(result => result.partial);
        return {
          status: partial ? ('partial' as const) : ('ready' as const),
          account,
          network: request.network,
          rows: [...byAsset.values()],
          errorMessage: partial
            ? 'Some balances could not be loaded.'
            : undefined,
        };
      }),
      catchError(() =>
        of({
          status: 'error' as const,
          account,
          network: request.network,
          rows: [],
          errorMessage: 'Failed to load balances.',
        })
      ),
      startWith({
        status: 'loading' as const,
        account,
        network: request.network,
        rows: [],
      })
    );
  }

  private matchesRequest(
    balance: WalletBalance,
    account: string,
    network: string
  ): boolean {
    if (balance.network !== network) {
      return false;
    }
    if (network.startsWith('eip155:')) {
      return balance.walletAddress.toLowerCase() === account.toLowerCase();
    }
    return balance.walletAddress === account;
  }
}
