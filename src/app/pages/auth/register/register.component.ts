import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import type { LoginMethod } from '@core/auth/auth-session.types';

type RegistrationMethod = 'email' | 'google' | 'apple';
type RegisterStep = 'account' | 'wallet';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  public email = '';
  public agreedToPolicy = false;
  public loading = false;
  public walletLoading = false;
  public isOpenWalletConnectMenu = false;
  public step: RegisterStep = 'account';
  public error = '';
  public info = '';

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly walletsService: WalletsService,
    private readonly walletGatewayBridge: WalletGatewayBridgeService
  ) {}

  public async registerWithEmail(): Promise<void> {
    this.error = '';
    this.info = '';

    if (!this.email.trim()) {
      this.error = 'Email is required.';
      return;
    }

    if (!this.isEmail(this.email)) {
      this.error = 'Enter a valid email address.';
      return;
    }

    if (!this.agreedToPolicy) {
      this.error = 'Please accept the policy to continue.';
      return;
    }

    await this.continueWith('email');
  }

  public async continueWith(method: RegistrationMethod): Promise<void> {
    this.error = '';
    this.info = '';

    if (!this.agreedToPolicy) {
      this.error = 'Please accept the policy to continue.';
      return;
    }

    this.loading = true;
    try {
      const session = await this.authSession.login(method as LoginMethod);
      if (session.wallets.length > 0) {
        await this.navigateToReturnUrl();
        return;
      }

      this.step = 'wallet';
      this.info = 'Choose how you want to secure your wallet access.';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Registration failed';
    } finally {
      this.loading = false;
    }
  }

  public connectExistingWallet(): void {
    this.error = '';
    this.info = '';
    this.isOpenWalletConnectMenu = true;
    this.walletsService.requestOpen();
  }

  public closeWalletConnectMenu(): void {
    this.isOpenWalletConnectMenu = false;
  }

  public async generateWallet(): Promise<void> {
    this.error = '';
    this.info = '';
    this.walletLoading = true;

    try {
      await this.walletGatewayBridge.createEmbeddedWallet();
      const wallets = await this.authSession.reloadWallets();
      if (wallets.length === 0) {
        throw new Error(
          'Wallet was created but profile refresh returned no wallets.'
        );
      }
      await this.navigateToReturnUrl();
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet setup failed';
    } finally {
      this.walletLoading = false;
    }
  }

  public async finishAfterWalletLinked(): Promise<void> {
    this.error = '';
    this.info = '';
    this.walletLoading = true;

    try {
      const wallets = await this.authSession.reloadWallets();
      if (wallets.length === 0) {
        this.error = 'Connect or generate a wallet to continue.';
        return;
      }
      await this.navigateToReturnUrl();
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Wallet refresh failed';
    } finally {
      this.walletLoading = false;
    }
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private navigateToReturnUrl(): Promise<boolean> {
    return this.router.navigateByUrl(this.returnUrl());
  }

  private returnUrl(): string {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value && value.startsWith('/') && !value.startsWith('//')
      ? value
      : '/';
  }
}
