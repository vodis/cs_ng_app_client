import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  UrlTree,
} from '@angular/router';
import { preferredLocalePath } from '@core/routing/localized-routing.service';
import { AuthProviderService } from './auth-provider.service';
import { AuthSessionService } from './auth-session.service';
import { TermsAcceptanceService } from './terms-acceptance.service';

@Injectable({ providedIn: 'root' })
export class TermsGuard implements CanActivate {
  constructor(
    private readonly authSession: AuthSessionService,
    private readonly authProvider: AuthProviderService,
    private readonly termsAcceptance: TermsAcceptanceService,
    private readonly router: Router
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const session = await this.resolveSession();
    const returnUrl = this.safeReturnUrl(route.queryParamMap.get('returnUrl'));

    if (!session) {
      // Prefer a localized `/login` URL so query params are not dropped by the
      // unprefixed `/login` → `/en/login` redirect hop.
      return this.router.parseUrl(
        `${preferredLocalePath('/login')}?returnUrl=${encodeURIComponent(returnUrl)}`
      );
    }

    if (this.termsAcceptance.hasAcceptedCurrent(session.user.id)) {
      return this.router.parseUrl(returnUrl);
    }

    return true;
  }

  private async resolveSession() {
    if (this.authSession.session) {
      return this.authSession.session;
    }

    const provider = await this.authProvider.whenSettled();
    return provider.status === 'ready' ? this.authSession.refresh() : null;
  }

  private safeReturnUrl(value: string | null): string {
    return value && value.startsWith('/') && !value.startsWith('//')
      ? value
      : '/';
  }
}
