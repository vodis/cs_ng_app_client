import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  Input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WalletAccount } from '@domains/wallet/models/wallet.models';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';

@Component({
  selector: 'app-wallet-bar',
  standalone: false,
  templateUrl: 'wallet-bar.component.html',
  styleUrls: [],
})
export class WalletBarComponent {
  @Input() showTrigger = true;
  @Input() hostModal = false;

  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly walletsService = inject(WalletsService);
  public isOpenWalletConnectMenu = false;
  public account: WalletAccount | undefined;

  constructor() {
    this.walletsService.account
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(account => {
        const hadAccount = Boolean(this.account?.account);
        this.account = account;
        if (this.hostModal && account && !hadAccount) {
          this.setWalletMenuOpen(false);
        }
      });

    this.walletsService.closeRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(closeRequested => {
        if (this.hostModal && closeRequested) {
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
  }

  public handleOpenWalletMenu(): void {
    if (this.hostModal) {
      this.setWalletMenuOpen(true);
      return;
    }

    this.walletsService.requestOpen();
  }

  public handleCloseWalletMenu(): void {
    this.setWalletMenuOpen(false);
  }

  private setWalletMenuOpen(isOpen: boolean): void {
    this.isOpenWalletConnectMenu = isOpen;
    this.changeDetector.markForCheck();
    this.changeDetector.detectChanges();
  }
}
