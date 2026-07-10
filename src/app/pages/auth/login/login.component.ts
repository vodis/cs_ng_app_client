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
  public loading = false;
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

    if (!this.email.trim()) {
      this.error = 'Email is required.';
      return;
    }

    if (!this.isEmail(this.email)) {
      this.error = 'Enter a valid email address.';
      return;
    }

    await this.continueWith('email');
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
