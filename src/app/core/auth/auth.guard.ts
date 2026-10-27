import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { preferredLocalePath } from '@core/routing/localized-routing.service';
import { AuthSessionService } from './auth-session.service';
import { AuthProviderService } from './auth-provider.service';
import { TermsAcceptanceService } from './terms-acceptance.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authSession: AuthSessionService,
    private readonly authProvider: AuthProviderService,
    private readonly termsAcceptance: TermsAcceptanceService,
    private readonly router: Router
  ) {}

  async canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    const returnUrl = this.safeReturnUrl(state.url);

    if (this.authSession.session) {
      return this.allowOrRequireTerms(
        this.authSession.session.user.id,
        returnUrl
      );
    }

    const provider = await this.authProvider.whenSettled();
    const session =
      provider.status === 'ready' ? await this.authSession.refresh() : null;
    if (!session) {
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl },
      });
    }

    return this.allowOrRequireTerms(session.user.id, returnUrl);
  }

  private allowOrRequireTerms(
    userId: string,
    returnUrl: string
  ): boolean | UrlTree {
    if (this.termsAcceptance.hasAcceptedCurrent(userId)) {
      return true;
    }

    // Prefer a localized `/terms` URL so query params are not dropped by the
    // unprefixed `/terms` → `/en/terms` redirect hop.
    return this.router.parseUrl(
      `${preferredLocalePath('/terms')}?returnUrl=${encodeURIComponent(returnUrl)}`
    );
  }

  private safeReturnUrl(url: string): string {
    return url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
