import { ActiveWalletFacade } from '@domains/wallet/application/active-wallet.facade';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  Input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WalletAccount } from '@domains/wallet/models/wallet.models';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import type { WalletDrawerMode } from '@shared/mfe/wallets/wallets.service';

@Component({
  selector: 'app-wallet-bar',
  standalone: false,
  templateUrl: 'wallet-bar.component.html',
  styleUrls: ['wallet-bar.component.scss'],
})
export class WalletBarComponent {
  @Input() showTrigger = true;
  @Input() hostModal = false;

  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly walletGatewayBridge = inject(WalletGatewayBridgeService);
  private readonly walletsService = inject(WalletsService);
  public isOpenWalletConnectMenu = false;
  public account: WalletAccount | undefined;
  public isGatewayConnected = false;
  public hasActiveWallet = false;
  private readonly activeWallet = inject(ActiveWalletFacade);
  public needsNearWalletLink = false;
  public drawerMode: WalletDrawerMode = 'wallet';

  /** Host X only when the connected board owns the drawer; MFE dialogs bring their own close. */
  public get showHostCloseButton(): boolean {
    return this.hasActiveWallet && this.drawerMode === 'wallet';
  }

  constructor() {
    this.activeWallet.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        this.hasActiveWallet = Boolean(state.wallet);
        this.changeDetector.markForCheck();
      });
    this.walletGatewayBridge.snapshot$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(snapshot => {
        const wasGatewayConnected = this.isGatewayConnected;
        this.isGatewayConnected = snapshot?.status === 'connected';
        this.needsNearWalletLink =
          snapshot?.identity?.chainType === 'near' &&
          snapshot.linkStatus !== undefined &&
          snapshot.linkStatus !== 'linked';
        if (
          this.hostModal &&
          this.isOpenWalletConnectMenu &&
          this.drawerMode !== 'swap-review' &&
          !wasGatewayConnected &&
          this.isGatewayConnected &&
          Boolean(snapshot?.account) &&
          !this.needsNearWalletLink
        ) {
          this.setWalletMenuOpen(false);
        } else {
          this.changeDetector.markForCheck();
        }
      });

    this.walletsService.account
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(account => {
        const hadAccount = Boolean(this.account?.account);
        this.account = account;
        if (
          this.hostModal &&
          this.isOpenWalletConnectMenu &&
          this.drawerMode === 'wallet' &&
          account &&
          !hadAccount
        ) {
          // The remote may call back before mount() returns its snapshot API.
          queueMicrotask(() => {
            if (
              this.hostModal &&
              this.isOpenWalletConnectMenu &&
              this.drawerMode === 'wallet' &&
              this.account?.account === account.account &&
              !this.walletGatewayBridge.supportsConnectionSnapshots()
            ) {
              this.setWalletMenuOpen(false);
            }
          });
        }
      });

    this.walletsService.closeRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(closeRequested => {
        if (this.hostModal && closeRequested) {
          // MFE already closed its dialog; sync the host shell and drawer mode.
          if (this.drawerMode === 'swap-review') {
            this.walletsService.drawerMode.next('wallet');
          }
          this.setWalletMenuOpen(false);
          this.walletsService.clearCloseRequest();
        }
      });

    this.walletsService.openRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(openRequested => {
        if (this.hostModal && openRequested) {
          this.setWalletMenuOpen(true);
          this.walletsService.clearOpenRequest();
        }
      });

    this.walletsService.drawerMode
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(mode => {
        this.drawerMode = mode;
        this.changeDetector.markForCheck();
      });
  }

  public handleOpenWalletMenu(): void {
    this.walletsService.drawerMode.next('wallet');
    if (this.hostModal) {
      this.setWalletMenuOpen(true);
      return;
    }

    this.walletsService.requestOpen('wallet');
  }

  public handleCloseWalletMenu(): void {
    if (this.drawerMode === 'swap-review') {
      if (this.walletGatewayBridge.isExecutionInProgress()) {
        return;
      }
      this.walletGatewayBridge.closeSwapReview();
      this.walletsService.drawerMode.next('wallet');
    } else {
      this.walletGatewayBridge.resetConnection();
    }
    this.setWalletMenuOpen(false);
  }

  private setWalletMenuOpen(isOpen: boolean): void {
    this.isOpenWalletConnectMenu = isOpen;
    this.changeDetector.markForCheck();
    this.changeDetector.detectChanges();
  }
}
