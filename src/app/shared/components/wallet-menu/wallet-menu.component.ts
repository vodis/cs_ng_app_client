import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WalletAccount } from '@domains/wallet/models/wallet.models';
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
  @Input() account: WalletAccount | undefined;
  @Output() accountClick = new EventEmitter<void>();

  public handleAccountClick(): void {
    this.accountClick.emit();
  }
}
