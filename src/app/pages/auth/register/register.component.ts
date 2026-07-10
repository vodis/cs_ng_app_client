import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import type { LoginMethod } from '@core/auth/auth-session.types';
import type { AuthSocialMethod } from '../shared/auth-social-buttons.component';
import { authPageTransition } from '../shared/auth-page.animations';

type RegisterStep = 'account' | 'wallet';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  animations: [authPageTransition],
})
export class RegisterComponent {
  public email = '';
  public agreedToPolicy = false;
  public loading = false;
  public walletLoading = false;
  public isOpenWalletConnectMenu = false;
  public isOpenEmailCodeModal = false;
  public emailCode = '';
  public codeEmail = '';
  public step: RegisterStep = 'account';
  public error = '';
  public info = '';

  constructor(
    public readonly authSession: AuthSessionService,
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

    this.loading = true;
    try {
      this.codeEmail = this.email.trim();
      await this.authSession.sendEmailCode(this.codeEmail);
      this.emailCode = '';
      this.isOpenEmailCodeModal = true;
      this.info = `Enter the verification code sent to ${this.codeEmail}.`;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Verification code failed';
    } finally {
      this.loading = false;
    }
  }

  public async verifyEmailCode(): Promise<void> {
    this.error = '';
    this.info = '';

    if (!this.emailCode.trim()) {
      this.error = 'Verification code is required.';
      return;
    }

    this.loading = true;
    try {
      const session = await this.authSession.verifyEmailCode(
        this.codeEmail,
        this.emailCode.trim()
      );
      this.isOpenEmailCodeModal = false;
      this.emailCode = '';
      if (await this.hasLinkedWallets(session.wallets.length)) {
        await this.navigateToReturnUrl();
        return;
      }

      this.step = 'wallet';
      this.info = 'Choose how you want to secure your wallet access.';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Verification failed';
    } finally {
      this.loading = false;
    }
  }

  public async resendEmailCode(): Promise<void> {
    this.error = '';
    this.info = '';
    this.loading = true;
    try {
      await this.authSession.sendEmailCode(this.codeEmail);
      this.info = `We sent a new code to ${this.codeEmail}.`;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Verification code failed';
    } finally {
      this.loading = false;
    }
  }

  public closeEmailCodeModal(): void {
    this.isOpenEmailCodeModal = false;
    this.emailCode = '';
  }

  public async continueWithSocial(method: AuthSocialMethod): Promise<void> {
    this.error = '';
    this.info = '';

    if (!this.agreedToPolicy) {
      this.error = 'Please accept the policy to continue.';
      return;
    }

    if (method === 'telegram') {
      this.info = 'Telegram registration is coming soon.';
      return;
    }

    await this.continueWith(method);
  }

  public async continueWith(method: LoginMethod): Promise<void> {
    this.error = '';
    this.info = '';

    if (!this.agreedToPolicy) {
      this.error = 'Please accept the policy to continue.';
      return;
    }

    this.loading = true;
    try {
      const session = await this.authSession.login(method);
      if (await this.hasLinkedWallets(session.wallets.length)) {
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

  private async hasLinkedWallets(initialCount: number): Promise<boolean> {
    if (initialCount > 0) {
      return true;
    }

    const wallets = await this.authSession.reloadWallets();
    return wallets.length > 0;
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
