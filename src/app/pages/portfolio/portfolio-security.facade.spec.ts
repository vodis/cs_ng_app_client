import { BehaviorSubject } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { PortfolioSecurityFacade } from './portfolio-security.facade';

describe('PortfolioSecurityFacade', () => {
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let facade: PortfolioSecurityFacade;

  const enabledSession: AuthSession = {
    user: {
      id: 'user-1',
      providerUserId: 'provider-1',
      sessionId: 'session-1',
      passkeyEnabled: true,
    },
    wallets: [],
  };

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['enablePasskey'],
      {
        session$: new BehaviorSubject<AuthSession | null>(null).asObservable(),
        loading$: new BehaviorSubject(false).asObservable(),
        passkeyLinkEnabled: true,
        passkeyLoginEnabled: true,
      }
    );
    facade = new PortfolioSecurityFacade(authSession);
  });

  it('exposes passkey capabilities from the session service', () => {
    expect(facade.passkeyLinkEnabled).toBeTrue();
    expect(facade.passkeyLoginEnabled).toBeTrue();
  });

  it('enables passkey through the session service', async () => {
    authSession.enablePasskey.and.resolveTo(enabledSession);

    await expectAsync(facade.enablePasskey()).toBeResolvedTo(enabledSession);
    expect(authSession.enablePasskey).toHaveBeenCalledTimes(1);
  });
});
