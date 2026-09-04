import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IDLE_WALLET_BALANCES_SNAPSHOT,
  type WalletBalanceRow,
  type WalletBalancesSnapshot,
} from '@mfe-contracts/wallet-balances.types';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import {
  EVM_CHAINS,
  findMockMarket,
  formatChangePercent,
  resolveDefaultEvmChainId,
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
  styleUrls: ['./connected-wallet-board.component.scss'],
})
export class ConnectedWalletBoardComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly walletGatewayBridge = inject(WalletGatewayBridgeService);
  private hasPickedChain = false;

  public snapshot: WalletConnectionSnapshot | undefined;
  public balances: WalletBalancesSnapshot = IDLE_WALLET_BALANCES_SNAPSHOT;
  public selectedEvmChainId = 1;
  public readonly networks = EVM_CHAINS;
  private lastSyncedAccount: string | undefined;

  constructor() {
    this.walletGatewayBridge.snapshot$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(snapshot => {
        this.snapshot = snapshot;
        if (!this.hasPickedChain) {
          this.selectedEvmChainId = resolveDefaultEvmChainId(snapshot?.chainId);
        }
        this.syncBalancesIfConnected(snapshot);
      });
    this.walletGatewayBridge.balances$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(balances => {
        this.balances = balances;
      });
  }

  public get account(): string {
    return this.snapshot?.account ?? '';
  }

  public get chainFamily(): SupportedChainFamily {
    return this.snapshot?.identity?.chainType ?? 'ethereum';
  }

  public get isEvm(): boolean {
    return this.chainFamily === 'ethereum';
  }

  public get activeNetwork(): EvmChainMock {
    for (const chain of EVM_CHAINS) {
      if (chain.chainId === this.selectedEvmChainId) {
        return chain;
      }
    }
    return EVM_CHAINS[0];
  }

  public get networkMeta(): string {
    const walletType = this.snapshot?.identity?.walletType ?? 'external';
    if (this.isEvm) {
      return `${this.activeNetwork.name.toLowerCase()} / ${walletType}`;
    }
    return `${this.chainFamily} / ${walletType}`;
  }

  public get rows(): ConnectedWalletBoardRow[] {
    if (!this.isEvm) {
      return [];
    }
    return this.balances.rows
      .filter(row => row.chainId === this.selectedEvmChainId)
      .map(row => ({
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
    if (!this.isEvm) {
      return 'Balances for this network are not available yet.';
    }
    const status = this.balances.status;
    if (status === 'error') {
      return this.balances.errorMessage ?? 'Failed to load balances.';
    }
    if (status === 'unavailable') {
      return 'Balances for this network are not available yet.';
    }
    if (status === 'loading' || status === 'idle') {
      return 'Loading balances...';
    }
    if (status === 'ready' && this.rows.length === 0) {
      return 'No balances yet.';
    }
    return '';
  }

  public activeNetworkLabel(): string {
    const chain = this.activeNetwork;
    return `${chain.name} · chain ${chain.chainId}`;
  }

  public shortAddress(address: string): string {
    if (!address.startsWith('0x') || address.length < 12) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  public isActiveNetwork(chain: EvmChainMock): boolean {
    return chain.chainId === this.selectedEvmChainId;
  }

  public selectNetwork(chain: EvmChainMock): void {
    this.hasPickedChain = true;
    this.selectedEvmChainId = chain.chainId;
    this.walletGatewayBridge.requestBalancesSync(chain.chainId);
  }

  public disconnect(): void {
    this.walletGatewayBridge.disconnectWallet();
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

  private syncBalancesIfConnected(
    snapshot: WalletConnectionSnapshot | undefined
  ): void {
    const account =
      snapshot?.status === 'connected' ? snapshot.account ?? undefined : undefined;
    const chainType = snapshot?.identity?.chainType;
    const isEvmAccount =
      Boolean(account?.startsWith('0x')) &&
      chainType !== 'near' &&
      chainType !== 'ton';

    if (!account || !isEvmAccount) {
      this.lastSyncedAccount = undefined;
      return;
    }

    if (account === this.lastSyncedAccount) {
      return;
    }

    this.lastSyncedAccount = account;
    this.walletGatewayBridge.requestBalancesSync(this.selectedEvmChainId);
  }

  private amountLabel(row: WalletBalanceRow): string {
    const amount = row.balanceDecimal ?? row.balanceRaw;
    const suffix = row.stale ? ' (stale)' : '';
    return `${amount}${suffix}`;
  }
}
