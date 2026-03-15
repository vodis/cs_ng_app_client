import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-wallet-account',
  standalone: true,
  templateUrl: 'wallet-account.component.html',
})
export class WalletAccountComponent implements OnChanges {
  @Input() account: string = '';
  public shortAccount: string = '';

  ngOnChanges() {
    this.shortAccount = `${this.account.substring(0, 7)}...${this.account.substring(this.account.length - 5)}`;
  }
}
