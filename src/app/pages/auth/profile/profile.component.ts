import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession, BackendWallet } from '@core/auth/auth-session.types';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  public session: AuthSession | null = null;
  public deletionMessage = '';
  public walletMessage = '';
  public error = '';
  public busyWalletId = '';

  private subscription?: Subscription;

  constructor(public readonly authSession: AuthSessionService) {}

  public ngOnInit(): void {
    this.subscription = this.authSession.session$.subscribe(session => {
      this.session = session;
    });
  }

  public ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  public shortAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  public walletMeta(wallet: BackendWallet): string {
    return [wallet.chainType, wallet.walletType, wallet.source]
      .filter(Boolean)
      .join(' / ');
  }

  public async refreshWallets(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    try {
      await this.authSession.reloadWallets();
      this.walletMessage = 'Wallets refreshed';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Wallet refresh failed';
    }
  }

  public async setPrimaryWallet(wallet: BackendWallet): Promise<void> {
    if (wallet.isPrimary) {
      return;
    }

    this.error = '';
    this.walletMessage = '';
    this.busyWalletId = wallet.id;
    try {
      await this.authSession.setPrimaryWallet(wallet.id);
      this.walletMessage = `${this.shortAddress(wallet.address)} is now active`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Wallet activation failed';
    } finally {
      this.busyWalletId = '';
    }
  }

  public async deleteWallet(wallet: BackendWallet): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    this.busyWalletId = wallet.id;
    try {
      await this.authSession.deleteWallet(wallet.id);
      this.walletMessage = `${this.shortAddress(wallet.address)} removed`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Wallet removal failed';
    } finally {
      this.busyWalletId = '';
    }
  }

  public async requestDeletion(): Promise<void> {
    this.error = '';
    this.deletionMessage = '';
    try {
      const deletionAvailableAt = await this.authSession.requestDeletion();
      this.deletionMessage = `Deletion available ${new Date(deletionAvailableAt).toLocaleDateString()}`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Account deletion failed';
    }
  }
}
