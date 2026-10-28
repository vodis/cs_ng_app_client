import { Router, UrlTree } from '@angular/router';
import { AuthProviderService } from './auth-provider.service';
import { AuthSessionService } from './auth-session.service';
import { AuthGuard } from './auth.guard';
import { TermsAcceptanceService } from './terms-acceptance.service';

describe('AuthGuard', () => {
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let authProvider: jasmine.SpyObj<AuthProviderService>;
  let termsAcceptance: jasmine.SpyObj<TermsAcceptanceService>;
  let router: jasmine.SpyObj<Router>;
  let guard: AuthGuard;
  let loginTree: UrlTree;
  let termsTree: UrlTree;

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
    termsAcceptance.hasAcceptedCurrent.and.returnValue(true);
    router = jasmine.createSpyObj<Router>('Router', ['parseUrl']);
    loginTree = {} as UrlTree;
    termsTree = {} as UrlTree;
    router.parseUrl.and.returnValue(termsTree);
    guard = new AuthGuard(authSession, authProvider, termsAcceptance, router);
  });

  it('waits for provider readiness before restoring a direct protected navigation', async () => {
    let settleProvider: ((status: 'ready') => void) | undefined;
    authProvider.whenSettled.and.returnValue(
      new Promise(resolve => {
        settleProvider = () =>
          resolve({
            status: 'ready',
            loginMethods: ['email'],
            passkeyLoginEnabled: false,
            passkeySignupEnabled: false,
            passkeyLinkEnabled: true,
            embeddedWalletEnabled: true,
          });
      })
    );
    authSession.refresh.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    });

    const activation = guard.canActivate(
      {} as never,
      {
        url: '/profile',
      } as never
    );
    expect(authSession.refresh).not.toHaveBeenCalled();
    settleProvider?.('ready');

    expect(await activation).toBeTrue();
    expect(authSession.refresh).toHaveBeenCalledTimes(1);
  });

  it('redirects without a session request when the provider is disabled', async () => {
    authProvider.whenSettled.and.resolveTo({
      status: 'disabled',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
    });

    router.parseUrl.and.returnValue(loginTree);

    const result = await guard.canActivate(
      {} as never,
      { url: '/profile' } as never
    );

    expect(authSession.refresh).not.toHaveBeenCalled();
    expect(result).toBe(loginTree);
    expect(router.parseUrl).toHaveBeenCalledOnceWith(
      '/en/login?returnUrl=%2Fprofile'
    );
  });

  it('uses root as the return URL when the requested URL is unsafe', async () => {
    authProvider.whenSettled.and.resolveTo({
      status: 'failed',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
    });
    router.parseUrl.and.returnValue(loginTree);

    const result = await guard.canActivate(
      {} as never,
      { url: '//example.test' } as never
    );

    expect(result).toBe(loginTree);
    expect(router.parseUrl).toHaveBeenCalledOnceWith('/en/login?returnUrl=%2F');
  });

  it('redirects authenticated users without Terms acceptance to /terms', async () => {
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

    const result = await guard.canActivate(
      {} as never,
      { url: '/portfolio' } as never
    );

    expect(result).toBe(termsTree);
    expect(router.parseUrl).toHaveBeenCalledOnceWith(
      '/en/terms?returnUrl=%2Fportfolio'
    );
  });
});
