import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActiveWalletFacade,
  type ActiveWalletState,
  type ActiveWalletBalances,
} from '@domains/wallet/application/active-wallet.facade';
import { hasPositiveBalance } from '@shared/utils/balance-asset.utils';
import { MarketSnapshotsService } from '@shared/services/market-snapshots.service';
import type { WalletBalance } from '@shared/services/wallet-balances.service';
import {
  emptyMarketSnapshot,
  formatChangePercent,
  formatCompactUsd,
  formatUsdPrice,
  marketIsDown,
  marketIsUp,
  type WalletMarketSnapshot,
} from '@shared/utils/market-display.util';
import {
  isNearWalletAddress,
  nearNetworkForAddress,
} from '@shared/utils/network.utils';
import { concat, interval, of, switchMap, type Subscription } from 'rxjs';
import {
  EVM_CHAINS,
  findKnownEvmChain,
  type EvmChainMock,
  type SupportedChainFamily,
} from './connected-wallet-board.mock';

export type ConnectedWalletBoardRow = {
  id: string;
  symbol: string;
  amount: string;
  stale: boolean;
  market: WalletMarketSnapshot;
};

const marketRefreshMs = 60_000;

@Component({
  selector: 'app-connected-wallet-board',
  standalone: false,
  templateUrl: './connected-wallet-board.component.html',
  styleUrls: [
    './connected-wallet-board.component.scss',
    './connected-wallet-board-tokens.component.scss',
  ],
})
export class ConnectedWalletBoardComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeWallet = inject(ActiveWalletFacade);
  private readonly marketSnapshots = inject(MarketSnapshotsService);

  public state?: ActiveWalletState;
  public balances?: ActiveWalletBalances;
  public selectedEvmChainId: number | null = null;
  public readonly networks = EVM_CHAINS;
  private marketRequestKey: string | undefined;
  private marketSubscription: Subscription | undefined;
  private markets = new Map<string, WalletMarketSnapshot>();

  constructor() {
    this.activeWallet.revalidateBalances();
    this.activeWallet.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        this.state = state;
        this.selectedEvmChainId = state.network?.startsWith('eip155:')
          ? Number(state.network.split(':')[1])
          : null;
      });
    this.activeWallet.balances$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        this.balances = state;
        this.refreshMarkets(state.rows);
      });
  }

  public connectForSigning(): void {
    this.activeWallet.requestConnection();
  }

  public get account(): string {
    return this.state?.wallet?.address ?? '';
  }

  public get chainFamily(): SupportedChainFamily {
    const fromIdentity = this.state?.wallet?.chainType;
    if (
      fromIdentity === 'near' ||
      fromIdentity === 'ton' ||
      fromIdentity === 'ethereum'
    ) {
      return fromIdentity;
    }
    const account = this.account;
    if (isNearWalletAddress(account)) {
      return 'near';
    }
    return 'ethereum';
  }

  public get isEvm(): boolean {
    return this.chainFamily === 'ethereum';
  }

  public get knownActiveNetwork(): EvmChainMock | undefined {
    return findKnownEvmChain(this.selectedEvmChainId);
  }

  public get networkMeta(): string {
    const walletType = this.state?.wallet?.walletType ?? 'external';
    if (this.isEvm) {
      const known = this.knownActiveNetwork;
      if (known) {
        return `${known.name.toLowerCase()} / ${walletType}`;
      }
      if (this.selectedEvmChainId != null) {
        return `chain ${this.selectedEvmChainId} / ${walletType}`;
      }
      return `evm / ${walletType}`;
    }
    return `${this.chainFamily} / ${walletType}`;
  }

  public get rows(): ConnectedWalletBoardRow[] {
    return (this.balances?.rows ?? [])
      .filter(row => hasPositiveBalance(row))
      .map(row => {
        const symbol = row.symbol.trim().toUpperCase();
        return {
          id: `${row.network}:${row.assetId}`,
          symbol: row.symbol,
          amount: this.amountLabel(row),
          stale: row.stale,
          market: this.markets.get(symbol) ?? emptyMarketSnapshot(symbol),
        };
      });
  }

  public get balancesCopy(): string {
    const status = this.balances?.status;
    if (!status) {
      return '';
    }
    if (status === 'error' || status === 'partial') {
      return this.balances?.errorMessage ?? 'Failed to load balances.';
    }
    if (status === 'loading') {
      return 'Loading balances...';
    }
    if (status === 'ready' && this.rows.length === 0) {
      return 'No balance on this wallet detected';
    }
    return '';
  }

  public activeNetworkName(): string {
    if (this.chainFamily === 'near') {
      return 'NEAR';
    }
    if (this.chainFamily === 'ton') {
      return 'TON';
    }
    return this.knownActiveNetwork?.name ?? 'EVM';
  }

  public activeNetworkLabel(): string {
    if (this.chainFamily === 'near') {
      const account = this.account;
      return nearNetworkForAddress(account) === 'near:testnet'
        ? 'NEAR · testnet'
        : 'NEAR · mainnet';
    }
    if (this.chainFamily === 'ton') {
      return this.state?.network === 'ton:testnet'
        ? 'TON · testnet'
        : 'TON · mainnet';
    }
    const known = this.knownActiveNetwork;
    if (known) {
      return `${known.name} · chain ${known.chainId}`;
    }
    if (this.selectedEvmChainId != null) {
      return `Unsupported · chain ${this.selectedEvmChainId}`;
    }
    return 'Unsupported · unknown chain';
  }

  public shortAddress(address: string): string {
    if (!address.startsWith('0x') || address.length < 12) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  public isActiveNetwork(chain: EvmChainMock): boolean {
    return (
      this.selectedEvmChainId != null &&
      chain.chainId === this.selectedEvmChainId
    );
  }

  public retryBalances(): void {
    this.activeWallet.refreshBalances();
  }

  public priceLabel(market: WalletMarketSnapshot): string {
    return formatUsdPrice(market.priceUsd);
  }

  public changeLabel(market: WalletMarketSnapshot): string {
    return formatChangePercent(market.change24hPercent);
  }

  public compactLabel(value: number): string {
    return formatCompactUsd(value);
  }

  public isTokenUp(market: WalletMarketSnapshot): boolean {
    return marketIsUp(market);
  }

  public isTokenDown(market: WalletMarketSnapshot): boolean {
    return marketIsDown(market);
  }

  public sparklineLabel(row: ConnectedWalletBoardRow): string {
    return `${row.symbol} 7-day price trend`;
  }

  private refreshMarkets(rows: WalletBalance[]): void {
    const symbols = [
      ...new Set(
        rows
          .filter(row => hasPositiveBalance(row))
          .map(row => row.symbol.trim().toUpperCase())
          .filter(symbol => symbol.length > 0)
      ),
    ].sort();
    const key = symbols.join(',');
    if (key === this.marketRequestKey) {
      return;
    }

    this.marketRequestKey = key;
    this.marketSubscription?.unsubscribe();
    this.marketSubscription = undefined;
    if (!key) {
      this.markets = new Map();
      return;
    }

    this.marketSubscription = concat(of(0), interval(marketRefreshMs))
      .pipe(
        switchMap(() => this.marketSnapshots.load(symbols)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(snapshots => {
        if (this.marketRequestKey !== key) {
          return;
        }
        this.markets = new Map(
          snapshots.map(snapshot => [snapshot.symbol, snapshot])
        );
      });
  }

  private amountLabel(row: WalletBalance): string {
    const amount = row.balanceDecimal ?? row.balanceRaw;
    return amount;
  }
}
