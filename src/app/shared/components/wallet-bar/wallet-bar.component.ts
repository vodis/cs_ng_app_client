import { Component } from '@angular/core';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';

@Component({
  selector: 'app-wallet-bar',
  standalone: false,
  templateUrl: 'wallet-bar.component.html',
  styleUrls: [],
})
export class WalletBarComponent {
  public isOpenWalletConnectMenu = false;
  public account: { account: string } | undefined;

  constructor(private walletsService: WalletsService) {
    this.walletsService.account.subscribe(account => {
      if (account) {
        const hadAccount = Boolean(this.account?.account);
        this.account = account;
        if (!hadAccount) {
          this.isOpenWalletConnectMenu = false;
        }
      }
    });

    this.walletsService.closeRequested.subscribe(closeRequested => {
      if (closeRequested) {
        this.isOpenWalletConnectMenu = false;
        this.walletsService.closeRequested.next(false);
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
