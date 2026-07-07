import { Component } from '@angular/core';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { WalletAccount } from '@domains/wallet/models/wallet.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef, inject } from '@angular/core';

@Component({
  selector: 'app-wallet-bar',
  standalone: false,
  templateUrl: 'wallet-bar.component.html',
  styleUrls: [],
})
export class WalletBarComponent {
  private readonly destroyRef = inject(DestroyRef);
  public isOpenWalletConnectMenu = false;
  public account: WalletAccount | undefined;

  constructor(private walletsService: WalletsService) {
    this.walletsService.account
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(account => {
        const hadAccount = Boolean(this.account?.account);
        this.account = account;
        if (account && !hadAccount) {
          this.isOpenWalletConnectMenu = false;
        }
      });

    this.walletsService.closeRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(closeRequested => {
        if (closeRequested) {
          this.isOpenWalletConnectMenu = false;
          this.walletsService.clearCloseRequest();
        }
      });

    this.walletsService.openRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(openRequested => {
        if (openRequested) {
          this.isOpenWalletConnectMenu = true;
          this.walletsService.clearOpenRequest();
        }
      });
  }

  public handleOpenWalletMenu(): void {
    this.isOpenWalletConnectMenu = true;
  }

  public handleCloseWalletMenu(): void {
    this.isOpenWalletConnectMenu = false;
  }
}
