import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { LoginMethod } from '@core/auth/auth-session.types';
import type { AuthSocialMethod } from '../shared/auth-social-buttons.component';
import { authPageTransition } from '../shared/auth-page.animations';

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

  public readonly socialMethods = LOGIN_SOCIAL_METHODS;

  constructor(
    public readonly authSession: AuthSessionService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
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

    await this.continueWith(method);
  }

  public async continueWith(method: LoginMethod): Promise<void> {
    this.error = '';
    this.info = '';
    this.loading = true;

    try {
      await this.authSession.login(method);
      await this.router.navigateByUrl(this.returnUrl());
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Login failed';
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
      await this.authSession.verifyEmailCode(
        this.codeEmail,
        this.emailCode.trim()
      );
      this.isOpenEmailCodeModal = false;
      this.emailCode = '';
      await this.router.navigateByUrl(this.returnUrl());
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

  private returnUrl(): string {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return value && value.startsWith('/') && !value.startsWith('//')
      ? value
      : '/';
  }
}
