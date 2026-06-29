import { Router, UrlTree } from '@angular/router';
import { AuthProviderService } from './auth-provider.service';
import { AuthSessionService } from './auth-session.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let authProvider: jasmine.SpyObj<AuthProviderService>;
  let router: jasmine.SpyObj<Router>;
  let guard: AuthGuard;

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
    router = jasmine.createSpyObj<Router>('Router', ['parseUrl']);
    router.parseUrl.and.returnValue({} as UrlTree);
    guard = new AuthGuard(authSession, authProvider, router);
  });

  it('waits for provider readiness before restoring a direct protected navigation', async () => {
    let settleProvider: ((status: 'ready') => void) | undefined;
    authProvider.whenSettled.and.returnValue(
      new Promise(resolve => {
        settleProvider = () =>
          resolve({ status: 'ready', loginMethods: ['email'] });
      })
    );
    authSession.refresh.and.resolveTo({
      user: {
        id: 'account-1',
        privyUserId: 'did:privy:user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    });

    const activation = guard.canActivate();
    expect(authSession.refresh).not.toHaveBeenCalled();
    settleProvider?.('ready');

    expect(await activation).toBeTrue();
    expect(authSession.refresh).toHaveBeenCalledTimes(1);
  });

  it('redirects without a session request when the provider is disabled', async () => {
    authProvider.whenSettled.and.resolveTo({
      status: 'disabled',
      loginMethods: [],
    });

    await guard.canActivate();

    expect(authSession.refresh).not.toHaveBeenCalled();
    expect(router.parseUrl).toHaveBeenCalledOnceWith('/login');
  });
});
