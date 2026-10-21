import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { BackendWallet } from '@core/auth/auth-session.types';
import type { ExchangeToken } from '@shared/models/exchange-token.model';
import { WalletBalancesService } from '@shared/services/wallet-balances.service';
import type { WalletBalance } from '@shared/services/wallet-balances.service';
import {
  canonicalBalanceAssetId,
  tokenBalance,
} from '@shared/utils/balance-asset.utils';
import { nearNetworkForAddress } from '@shared/utils/network.utils';
import {
  BehaviorSubject,
  combineLatest,
  from,
  of,
  catchError,
  concatMap,
  distinctUntilChanged,
  map,
  mergeMap,
  scan,
  shareReplay,
  startWith,
  switchMap,
  toArray,
} from 'rxjs';

export interface LinkedTokenHolding {
  token: ExchangeToken;
  wallet: BackendWallet;
  network: string;
  balance?: WalletBalance;
}

export interface LinkedBalancesState {
  holdings: LinkedTokenHolding[];
  loading: boolean;
  incomplete: boolean;
}

/** Compatibility for display reads, not authorization to trade or sign. */
export function walletSupportsNetwork(
  wallet: BackendWallet,
  network: string
): boolean {
  if (wallet.deletedAt || (wallet.status && wallet.status !== 'active'))
    return false;
  switch (wallet.chainType) {
    case 'ethereum':
    case 'evm':
      return /^eip155:[1-9]\d*$/.test(network);
    case 'near':
      return network === nearNetworkForAddress(wallet.address);
    case 'ton':
      return network === 'ton:mainnet';
    case 'solana':
      return network === 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
    case 'bitcoin':
      return network === 'bip122:000000000019d6689c085ae165831e93';
    default:
      return false;
  }
}

export function holdingKey(holding: LinkedTokenHolding): string {
  const address = holding.network.startsWith('eip155:')
    ? holding.wallet.address.toLowerCase()
    : holding.wallet.address;
  const assetId =
    holding.balance?.assetId ??
    holding.token.balanceAssetId ??
    holding.token.assetId;
  return `${address}|${holding.network}|${canonicalBalanceAssetId(assetId, holding.network)}`;
}

@Injectable({ providedIn: 'root' })
export class LinkedWalletBalancesFacade {
  private readonly catalog = new BehaviorSubject<ExchangeToken[]>([]);
  readonly state$ = combineLatest([
    this.auth.session$.pipe(
      map(session =>
        session
          ? {
              userId: session.user.id,
              sessionId: session.user.sessionId,
              wallets: session.wallets,
            }
          : null
      ),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ),
    this.catalog,
  ]).pipe(
    switchMap(([session, tokens]) => {
      const initial: LinkedBalancesState = {
        holdings: [],
        loading: false,
        incomplete: false,
      };
      if (!session || !tokens.length) return of(initial);
      const targets = session.wallets.flatMap(wallet => {
        const networks = [
          ...new Set(
            tokens.flatMap(token =>
              token.sourceNetwork &&
              walletSupportsNetwork(wallet, token.sourceNetwork)
                ? [token.sourceNetwork]
                : []
            )
          ),
        ];
        return networks.map(network => ({
          wallet,
          network,
          tokens: tokens.filter(token => token.sourceNetwork === network),
        }));
      });
      const pending: LinkedTokenHolding[] = targets.flatMap(target =>
        target.tokens.map(token => ({
          token,
          wallet: target.wallet,
          network: target.network,
        }))
      );
      if (!targets.length) return of(initial);
      return from(targets).pipe(
        mergeMap(target => {
          const ids = [...new Set(target.tokens.map(token => token.assetId))];
          const batches: string[][] = [];
          for (let i = 0; i < ids.length; i += 20)
            batches.push(ids.slice(i, i + 20));
          return from(batches).pipe(
            concatMap(assetIds =>
              this.balances
                .loadBalancesWithMeta({
                  walletAddress: target.wallet.address,
                  network: target.network,
                  assetIds,
                })
                .pipe(
                  map(result => {
                    const address = (value: string) =>
                      target.network.startsWith('eip155:')
                        ? value.toLowerCase()
                        : value;
                    if (
                      result.balances.some(
                        row =>
                          row.network !== target.network ||
                          address(row.walletAddress) !==
                            address(target.wallet.address) ||
                          (row.walletId != null &&
                            row.walletId !== target.wallet.id)
                      )
                    )
                      throw new Error('Balance provenance mismatch');
                    return result;
                  }),
                  catchError((error: unknown) => {
                    if (
                      error instanceof HttpErrorResponse &&
                      error.status === 401
                    )
                      this.auth.clear();
                    return of({ balances: [], partial: true });
                  })
                )
            ),
            toArray(),
            map(results => {
              const rows = results.flatMap(result => result.balances);
              return {
                target,
                incomplete: results.some(result => result.partial),
                holdings: target.tokens.map(token => ({
                  token,
                  wallet: target.wallet,
                  network: target.network,
                  balance: tokenBalance(rows, token, target.network),
                })),
              };
            })
          );
        }, 3),
        scan(
          (state, result) => ({
            holdings: [
              ...state.holdings.filter(
                holding =>
                  holding.wallet.id !== result.target.wallet.id ||
                  holding.network !== result.target.network
              ),
              ...result.holdings,
            ],
            incomplete:
              state.incomplete ||
              result.incomplete ||
              result.holdings.some(holding => !holding.balance),
            remaining: state.remaining - 1,
          }),
          {
            holdings: pending,
            incomplete: false,
            remaining: targets.length,
          }
        ),
        map(state => ({
          holdings: state.holdings,
          incomplete: state.incomplete,
          loading: state.remaining > 0,
        })),
        startWith({ holdings: pending, loading: true, incomplete: false })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private readonly auth: AuthSessionService,
    private readonly balances: WalletBalancesService
  ) {}

  refresh(tokens: ExchangeToken[]): void {
    this.catalog.next(tokens);
  }
  close(): void {
    this.catalog.next([]);
  }
}
