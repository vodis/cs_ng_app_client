import { convertToParamMap, Router, UrlTree } from '@angular/router';
import { AuthProviderService } from './auth-provider.service';
import { AuthSessionService } from './auth-session.service';
import { TermsAcceptanceService } from './terms-acceptance.service';
import { TermsGuard } from './terms.guard';

describe('TermsGuard', () => {
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let authProvider: jasmine.SpyObj<AuthProviderService>;
  let termsAcceptance: jasmine.SpyObj<TermsAcceptanceService>;
  let router: jasmine.SpyObj<Router>;
  let guard: TermsGuard;
  let loginTree: UrlTree;
  let returnTree: UrlTree;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['refresh'],
      { session: null }
    );
    authProvider = jasmine.createSpyObj<AuthProviderService>(
      'AuthProviderService',
      ['whenSettled']
    );
    termsAcceptance = jasmine.createSpyObj<TermsAcceptanceService>(
      'TermsAcceptanceService',
      ['hasAcceptedCurrent']
    );
    router = jasmine.createSpyObj<Router>('Router', [
      'createUrlTree',
      'parseUrl',
    ]);
    loginTree = {} as UrlTree;
    returnTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(loginTree);
    router.parseUrl.and.returnValue(returnTree);
    guard = new TermsGuard(authSession, authProvider, termsAcceptance, router);
  });

  it('redirects guests to login while preserving returnUrl', async () => {
    authProvider.whenSettled.and.resolveTo({
      status: 'disabled',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
    });

    const result = await guard.canActivate({
      queryParamMap: convertToParamMap({ returnUrl: '/farm' }),
    } as never);

    expect(result).toBe(loginTree);
    expect(router.createUrlTree).toHaveBeenCalledOnceWith(['/login'], {
      queryParams: { returnUrl: '/farm' },
    });
  });

  it('allows the Terms page when acceptance is still required', async () => {
    Object.defineProperty(authSession, 'session', {
      configurable: true,
      get: () => ({
        user: {
          id: 'account-1',
          providerUserId: 'provider-user-1',
          sessionId: 'session-1',
        },
        wallets: [],
      }),
    });
    termsAcceptance.hasAcceptedCurrent.and.returnValue(false);

    await expectAsync(
      guard.canActivate({
        queryParamMap: convertToParamMap({ returnUrl: '/profile' }),
      } as never)
    ).toBeResolvedTo(true);
  });

  it('continues to returnUrl when Terms are already accepted', async () => {
    Object.defineProperty(authSession, 'session', {
      configurable: true,
      get: () => ({
        user: {
          id: 'account-1',
          providerUserId: 'provider-user-1',
          sessionId: 'session-1',
        },
        wallets: [],
      }),
    });
    termsAcceptance.hasAcceptedCurrent.and.returnValue(true);

    const result = await guard.canActivate({
      queryParamMap: convertToParamMap({ returnUrl: '/profile' }),
    } as never);

    expect(result).toBe(returnTree);
    expect(router.parseUrl).toHaveBeenCalledOnceWith('/profile');
  });
});
