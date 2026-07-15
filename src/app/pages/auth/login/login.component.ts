import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { LoginMethod } from '@core/auth/auth-session.types';
import type { AuthSocialMethod } from '../shared/auth-social-buttons.component';
import { authPageTransition } from '../shared/auth-page.animations';
import {
  hasLinkedWallets,
  readReturnUrl,
} from '../shared/auth-navigation.helper';
import {
  resolveLoginError,
  PASSKEY_LOGIN_UNAVAILABLE_MESSAGE,
} from '../shared/auth-login-messages.helper';
import { ProductEventsService } from '@core/product-events/product-events.service';

const LOGIN_SOCIAL_METHODS: AuthSocialMethod[] = [
  'passkey',
  'google',
  'apple',
  'telegram',
];

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  animations: [authPageTransition],
})
export class LoginComponent {
  public email = '';
  public emailCode = '';
  public codeEmail = '';
  public loading = false;
  public isOpenEmailCodeModal = false;
  public error = '';
  public info = '';

  public get socialMethods(): AuthSocialMethod[] {
    const loginMethods = new Set(this.authSession.enabledLoginMethods);
    return LOGIN_SOCIAL_METHODS.filter(
      method => method === 'telegram' || loginMethods.has(method)
    );
  }

  public disabledSocialMethods(
    providerPasskeyLoginEnabled: boolean
  ): AuthSocialMethod[] {
    return providerPasskeyLoginEnabled ? [] : ['passkey'];
  }

  public showPasskeyLoginUnavailableNote(
    providerPasskeyLoginEnabled: boolean
  ): boolean {
    return !providerPasskeyLoginEnabled;
  }

  public passkeyLoginUnavailableNote = PASSKEY_LOGIN_UNAVAILABLE_MESSAGE;

  constructor(
    public readonly authSession: AuthSessionService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly productEvents: ProductEventsService
  ) {}

  public async loginWithEmail(): Promise<void> {
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

  public async continueWithSocial(method: AuthSocialMethod): Promise<void> {
    this.error = '';
    this.info = '';

    if (method === 'telegram') {
      this.info = 'Telegram login is coming soon.';
      return;
    }

    if (method === 'passkey' && !this.authSession.passkeyLoginEnabled) {
      this.info = PASSKEY_LOGIN_UNAVAILABLE_MESSAGE;
      return;
    }

    await this.continueWith(method);
  }

  public async continueWith(method: LoginMethod): Promise<void> {
    this.error = '';
    this.info = '';
    this.loading = true;

    try {
      const session = await this.authSession.login(method);
      await this.navigateAfterAuth(session.wallets.length);
    } catch (error) {
      this.error = resolveLoginError(method, error, {
        reasonCode: this.productEvents.reason(error),
      });
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
      await this.navigateAfterAuth(session.wallets.length);
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

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private async navigateAfterAuth(initialWalletCount: number): Promise<void> {
    if (await hasLinkedWallets(this.authSession, initialWalletCount)) {
      await this.router.navigateByUrl(
        readReturnUrl(this.route.snapshot.queryParamMap)
      );
      return;
    }

    await this.router.navigate(['/generate-wallet'], {
      queryParams: {
        returnUrl: readReturnUrl(this.route.snapshot.queryParamMap),
      },
    });
  }
}
