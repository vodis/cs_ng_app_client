import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WalletAccount } from '@domains/wallet/models/wallet.models';

@Injectable({
  providedIn: 'root',
})
export class WalletsService {
  public provider = new BehaviorSubject<unknown | undefined>(undefined);
  public account = new BehaviorSubject<WalletAccount | undefined>(undefined);
  public closeRequested = new BehaviorSubject<boolean>(false);

  setAccount(account: WalletAccount | undefined): void {
    this.account.next(account);
  }

  requestClose(): void {
    this.closeRequested.next(true);
  }

  clearCloseRequest(): void {
    this.closeRequested.next(false);
  }
}
