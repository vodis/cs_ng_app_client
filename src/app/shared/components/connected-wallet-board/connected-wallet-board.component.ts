import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { WalletConnectionSnapshot } from '@mfe-contracts/wallet-mfe.types';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import {
  EVM_CHAINS,
  formatChangePercent,
  getMockBalances,
  getMockTotalUsd,
  resolveDefaultEvmChainId,
  sparklineIsUp,
  type EvmChainMock,
  type SupportedChainFamily,
  type TokenBalanceMock,
} from './connected-wallet-board.mock';

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
  public selectedEvmChainId = 1;
  public readonly networks = EVM_CHAINS;

  constructor() {
    this.walletGatewayBridge.snapshot$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(snapshot => {
        this.snapshot = snapshot;
        if (!this.hasPickedChain) {
          this.selectedEvmChainId = resolveDefaultEvmChainId(snapshot?.chainId);
        }
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

  public get mockTokens(): TokenBalanceMock[] {
    return getMockBalances(this.chainFamily, this.selectedEvmChainId);
  }

  public get mockTotalUsd(): string {
    return getMockTotalUsd(this.mockTokens);
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

  public changeLabel(token: TokenBalanceMock): string {
    return formatChangePercent(token.change24h);
  }

  public isTokenUp(token: TokenBalanceMock): boolean {
    return sparklineIsUp(token.sparkline7d);
  }

  public sparklineLabel(token: TokenBalanceMock): string {
    return `${token.symbol} 7-day price trend`;
  }
}
