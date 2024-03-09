import { Component, Input } from '@angular/core';
import { Account } from '../../../models/wallet';

@Component({
  selector: 'app-wallet-menu',
  templateUrl: 'wallet-menu.component.html',
  styleUrls: ['wallet-menu.component.scss'],
})
export class WalletMenuComponent {
  @Input() account: Account | undefined;
}
