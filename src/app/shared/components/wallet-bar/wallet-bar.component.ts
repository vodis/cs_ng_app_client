import { Component } from '@angular/core';

@Component({
  selector: 'app-wallet-bar',
  templateUrl: 'wallet-bar.component.html',
  styleUrls: [],
})
export class WalletBarComponent {
  public isOpenWalletConnectMenu = false;

  public handleOpenWalletMenu(): void {
    this.isOpenWalletConnectMenu = true;
  }
}
