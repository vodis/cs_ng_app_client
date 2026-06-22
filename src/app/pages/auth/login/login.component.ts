import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { LoginMethod } from '@core/auth/auth-session.types';

const LOGIN_LABELS: Record<LoginMethod, string> = {
  email: 'Email',
  google: 'Google',
  apple: 'Apple',
  passkey: 'Passkey',
};

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  public error = '';

  constructor(
    public readonly authSession: AuthSessionService,
    private readonly router: Router
  ) {}

  public get loginMethods(): LoginMethod[] {
    return this.authSession.enabledLoginMethods;
  }

  public labelFor(method: LoginMethod): string {
    return LOGIN_LABELS[method];
  }

  public async login(method: LoginMethod): Promise<void> {
    this.error = '';
    try {
      await this.authSession.login(method);
      await this.router.navigateByUrl('/profile');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Login failed';
    }
  }
}
