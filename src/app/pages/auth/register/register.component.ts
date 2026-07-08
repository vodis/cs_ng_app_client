import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { LoginMethod } from '@core/auth/auth-session.types';

type SocialRegistrationMethod = 'google' | 'apple' | 'telegram';

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
  public error = '';
  public info = '';

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly router: Router
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

    this.info =
      'Email registration will be enabled soon. Use Google or Apple for now.';
  }

  public async continueWith(method: SocialRegistrationMethod): Promise<void> {
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

    this.loading = true;
    try {
      await this.authSession.login(method as LoginMethod);
      await this.router.navigateByUrl('/profile');
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Registration failed';
    } finally {
      this.loading = false;
    }
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }
}
