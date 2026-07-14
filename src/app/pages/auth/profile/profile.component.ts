import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type {
  AuthSession,
  BackendBalance,
  BackendWallet,
} from '@core/auth/auth-session.types';

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
  public balanceMessage = '';
  public passkeyMessage = '';
  public error = '';
  public busyWalletId = '';
  public passkeyLoading = false;
  public balances: BackendBalance[] = [];
  public balancesLoading = false;

  private subscription?: Subscription;

  constructor(public readonly authSession: AuthSessionService) {}

  public ngOnInit(): void {
    this.subscription = this.authSession.session$.subscribe(session => {
      this.session = session;
      if (session) {
        void this.refreshBalances();
      } else {
        this.balances = [];
      }
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

  public balanceAmount(balance: BackendBalance): string {
    const amount =
      balance.balanceDecimal ||
      this.rawToDecimal(balance.balanceRaw, balance.decimals);
    return `${amount} ${balance.symbol}`;
  }

  public balanceMeta(balance: BackendBalance): string {
    const expiry = new Date(balance.expiresAt);
    const expiresAt = Number.isNaN(expiry.getTime())
      ? 'cache'
      : `cache until ${expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `${this.shortAddress(balance.walletAddress)} / ${balance.chainType} / ${expiresAt}`;
  }

  public canEnablePasskey(): boolean {
    return this.authSession.enabledLoginMethods.includes('passkey');
  }

  public canDisablePasskey(): boolean {
    return this.authSession.canDisablePasskey();
  }

  public async enablePasskey(): Promise<void> {
    this.error = '';
    this.passkeyMessage = '';
    this.passkeyLoading = true;
    try {
      await this.authSession.enablePasskey();
      this.passkeyMessage = 'Passkey authentication enabled';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Passkey enablement failed';
    } finally {
      this.passkeyLoading = false;
    }
  }

  public async disablePasskey(): Promise<void> {
    this.error = '';
    this.passkeyMessage = '';
    this.passkeyLoading = true;
    try {
      await this.authSession.disablePasskey();
      this.passkeyMessage = 'Passkey authentication disabled';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Passkey disable failed';
    } finally {
      this.passkeyLoading = false;
    }
  }

  public async refreshWallets(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    try {
      await this.authSession.reloadWallets();
      this.walletMessage = 'Wallets refreshed';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet refresh failed';
    }
  }

  public async refreshBalances(): Promise<void> {
    this.error = '';
    this.balanceMessage = '';
    this.balancesLoading = true;
    try {
      this.balances = await this.authSession.loadBalances();
      this.balanceMessage =
        this.balances.length > 0 ? 'Balances refreshed' : '';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Balance refresh failed';
    } finally {
      this.balancesLoading = false;
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
      this.error =
        error instanceof Error ? error.message : 'Wallet activation failed';
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
      this.error =
        error instanceof Error ? error.message : 'Wallet removal failed';
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
      this.error =
        error instanceof Error ? error.message : 'Account deletion failed';
    }
  }

  public async logout(): Promise<void> {
    this.error = '';
    this.walletMessage = '';
    this.balanceMessage = '';
    this.deletionMessage = '';
    this.passkeyMessage = '';
    try {
      await this.authSession.logout();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Logout failed';
    }
  }

  private rawToDecimal(rawBalance: string, decimals: number): string {
    if (!/^\d+$/.test(rawBalance) || decimals <= 0) {
      return rawBalance;
    }

    const padded = rawBalance.padStart(decimals + 1, '0');
    const whole = padded.slice(0, -decimals);
    const fraction = padded.slice(-decimals).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
  }
}
