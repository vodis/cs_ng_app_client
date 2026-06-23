import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthSessionService } from './auth-session.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authSession: AuthSessionService,
    private readonly router: Router
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    if (this.authSession.session) {
      return true;
    }

    const session = await this.authSession.refresh();
    return session ? true : this.router.parseUrl('/login');
  }
}
