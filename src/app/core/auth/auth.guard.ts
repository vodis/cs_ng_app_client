import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthSessionService } from './auth-session.service';
import { AuthProviderService } from './auth-provider.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authSession: AuthSessionService,
    private readonly authProvider: AuthProviderService
  ) {}

  async canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Promise<boolean> {
    if (this.authSession.session) {
      return true;
    }

    const provider = await this.authProvider.whenSettled();
    if (provider.status === 'ready') {
      await this.authSession.refresh();
    }

    return true;
  }
}
