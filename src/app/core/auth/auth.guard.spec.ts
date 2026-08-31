import { AuthProviderService } from './auth-provider.service';
import { AuthSessionService } from './auth-session.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let authProvider: jasmine.SpyObj<AuthProviderService>;
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
    guard = new AuthGuard(authSession, authProvider);
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

  it('allows navigation without a session request when the provider is disabled', async () => {
    authProvider.whenSettled.and.resolveTo({
      status: 'disabled',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
    });

    expect(
      await guard.canActivate({} as never, { url: '/farm' } as never)
    ).toBeTrue();
    expect(authSession.refresh).not.toHaveBeenCalled();
  });

  it('allows navigation when the provider failed and there is no session', async () => {
    authProvider.whenSettled.and.resolveTo({
      status: 'failed',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
    });

    expect(
      await guard.canActivate({} as never, { url: '/farm' } as never)
    ).toBeTrue();
    expect(authSession.refresh).not.toHaveBeenCalled();
  });
});
