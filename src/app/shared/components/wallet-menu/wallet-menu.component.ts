import { Component, Input } from '@angular/core';
import { Account } from '../../../models/wallet';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { WalletAccountComponent } from '@shared/components/wallet-account/wallet-account.component';

@Component({
  selector: 'app-wallet-menu',
  standalone: true,
  imports: [AvatarComponent, WalletAccountComponent],
  templateUrl: 'wallet-menu.component.html',
  styleUrls: ['wallet-menu.component.scss'],
})
export class WalletMenuComponent {
  @Input() account: Account | undefined;
}
