import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import {
  ConnectedWalletBalancesFacade,
  type ConnectedWalletBalancesState,
} from '@domains/wallet/application/connected-wallet-balances.facade';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import type { WalletBalance } from '@shared/services/wallet-balances.service';
import {
  isNearWalletAddress,
  nearNetworkForAddress,
} from '@shared/utils/network.utils';
import type { Subscription } from 'rxjs';
import {
  EVM_CHAINS,
  findKnownEvmChain,
  findMockMarket,
  formatChangePercent,
  resolveConnectedEvmChainId,
  sparklineIsUp,
  type EvmChainMock,
  type SupportedChainFamily,
  type TokenBalanceMock,
} from './connected-wallet-board.mock';

export type ConnectedWalletBoardRow = {
  id: string;
  symbol: string;
  amount: string;
  stale: boolean;
  market?: TokenBalanceMock;
};

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
  private readonly walletGatewayBridge = inject(WalletGatewayBridgeService);
  private readonly balancesFacade = inject(ConnectedWalletBalancesFacade);

  public snapshot: WalletConnectionSnapshot | undefined;
  public balances: ConnectedWalletBalancesState | undefined;
  public selectedEvmChainId: number | null = null;
  public readonly networks = EVM_CHAINS;
  private balanceRequestKey: string | undefined;
  private balanceSubscription: Subscription | undefined;

  constructor() {
    this.walletGatewayBridge.snapshot$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(snapshot => {
        this.snapshot = snapshot;
        this.selectedEvmChainId = resolveConnectedEvmChainId(snapshot?.chainId);
        this.loadBalancesIfConnected(snapshot);
      });
  }

  public get account(): string {
    return this.snapshot?.account ?? '';
  }

  public get chainFamily(): SupportedChainFamily {
    const fromIdentity = this.snapshot?.identity?.chainType;
    if (
      fromIdentity === 'near' ||
      fromIdentity === 'ton' ||
      fromIdentity === 'ethereum'
    ) {
      return fromIdentity;
    }
    const account = this.snapshot?.account ?? '';
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
    const walletType = this.snapshot?.identity?.walletType ?? 'external';
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
    return (this.balances?.rows ?? []).map(row => ({
      id: `${row.network}:${row.assetId}`,
      symbol: row.symbol,
      amount: this.amountLabel(row),
      stale: row.stale,
      market: findMockMarket(
        row.symbol,
        this.chainFamily,
        this.selectedEvmChainId
      ),
    }));
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
      return 'No balances yet.';
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
      const account = this.snapshot?.account ?? '';
      return nearNetworkForAddress(account) === 'near:testnet'
        ? 'NEAR · testnet'
        : 'NEAR · mainnet';
    }
    if (this.chainFamily === 'ton') {
      return this.snapshot?.chainId === -3 ? 'TON · testnet' : 'TON · mainnet';
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
    this.loadBalancesIfConnected(this.snapshot, true);
  }

  public changeLabel(market: TokenBalanceMock): string {
    return formatChangePercent(market.change24h);
  }

  public isTokenUp(market: TokenBalanceMock): boolean {
    return sparklineIsUp(market.sparkline7d);
  }

  public sparklineLabel(row: ConnectedWalletBoardRow): string {
    return `${row.symbol} 7-day price trend`;
  }

  private loadBalancesIfConnected(
    snapshot: WalletConnectionSnapshot | undefined,
    force = false
  ): void {
    const account =
      snapshot?.status === 'connected'
        ? (snapshot.account ?? undefined)
        : undefined;
    const network = account ? this.balanceNetwork(account) : undefined;

    if (!account || !network) {
      this.balanceSubscription?.unsubscribe();
      this.balanceSubscription = undefined;
      this.balanceRequestKey = undefined;
      this.balances = undefined;
      return;
    }

    const requestAccount = network.startsWith('eip155:')
      ? account.toLowerCase()
      : account;
    const requestKey = `${requestAccount}|${network}`;
    if (!force && requestKey === this.balanceRequestKey) {
      return;
    }

    this.balanceRequestKey = requestKey;
    this.balanceSubscription?.unsubscribe();
    this.balanceSubscription = this.balancesFacade
      .load({ account, network })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        if (this.balanceRequestKey === requestKey) {
          this.balances = state;
          if (state.status === 'error' || state.status === 'partial') {
            this.balanceRequestKey = undefined;
          }
        }
      });
  }

  private balanceNetwork(account: string): string | undefined {
    if (this.chainFamily === 'near') {
      return nearNetworkForAddress(account);
    }
    if (this.chainFamily === 'ton') {
      return this.snapshot?.chainId === -3 ? 'ton:testnet' : 'ton:mainnet';
    }
    if (/^0x[a-f0-9]{40}$/i.test(account) && this.selectedEvmChainId != null) {
      return `eip155:${this.selectedEvmChainId}`;
    }
    return undefined;
  }

  private amountLabel(row: WalletBalance): string {
    const amount = row.balanceDecimal ?? row.balanceRaw;
    const suffix = row.stale ? ' (stale)' : '';
    return `${amount}${suffix}`;
  }
}
