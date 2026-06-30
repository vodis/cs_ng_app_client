import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { AuthProviderService } from './auth-provider.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authSession: AuthSessionService,
    private readonly authProvider: AuthProviderService,
    private readonly router: Router
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    if (this.authSession.session) {
      return true;
    }

    const provider = await this.authProvider.whenSettled();
    const session =
      provider.status === 'ready' ? await this.authSession.refresh() : null;
    return session ? true : this.router.parseUrl('/login');
  }
}
