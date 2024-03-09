import { Component } from '@angular/core';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';

@Component({
  selector: 'app-wallet-bar',
  templateUrl: 'wallet-bar.component.html',
  styleUrls: [],
})
export class WalletBarComponent {
  public isOpenWalletConnectMenu = false;
  public account: { account: string } | undefined;

  constructor(private walletsService: WalletsService) {
    this.walletsService.account.subscribe(account => {
      if (account) {
        this.account = account;
        this.isOpenWalletConnectMenu = false;
      }
    });
  }

  public handleOpenWalletMenu(): void {
    this.isOpenWalletConnectMenu = true;
  }
}
