import { BehaviorSubject } from 'rxjs';
import type { AuthSession } from '@core/auth/auth-session.types';
import { PortfolioSecurityComponent } from './portfolio-security.component';
import { PortfolioSecurityFacade } from './portfolio-security.facade';

describe('PortfolioSecurityComponent', () => {
  let security: jasmine.SpyObj<PortfolioSecurityFacade>;
  let sessionSubject: BehaviorSubject<AuthSession | null>;
  let component: PortfolioSecurityComponent;

  const baseSession = {
    user: {
      id: 'user-1',
      providerUserId: 'provider-1',
      sessionId: 'session-1',
      passkeyEnabled: false,
    },
    wallets: [],
  } as AuthSession;

  beforeEach(() => {
    sessionSubject = new BehaviorSubject<AuthSession | null>(baseSession);
    security = jasmine.createSpyObj<PortfolioSecurityFacade>(
      'PortfolioSecurityFacade',
      ['enablePasskey'],
      {
        session$: sessionSubject.asObservable(),
        loading$: new BehaviorSubject(false).asObservable(),
        passkeyLinkEnabled: true,
        passkeyLoginEnabled: true,
      }
    );
    component = new PortfolioSecurityComponent(security);
    component.ngOnInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('enables passkey through the facade', async () => {
    security.enablePasskey.and.callFake(async () => {
      const next = {
        ...baseSession,
        user: { ...baseSession.user, passkeyEnabled: true },
      };
      sessionSubject.next(next);
      return next;
    });

    await component.enablePasskey();

    expect(security.enablePasskey).toHaveBeenCalledTimes(1);
    expect(component.passkeyEnabled).toBeTrue();
    expect(component.message).toBe('Passkey authentication enabled.');
  });

  it('explains disable and recover when passkey APIs are unavailable', () => {
    component.disablePasskey();
    expect(component.message).toContain('Passkey unlink is not available');

    component.recoverPasskey();
    expect(component.message).toContain('sign in with Google');
  });

  it('toggles the local 2FA preview state', async () => {
    await component.enableTwoFactor();
    expect(component.twoFactorEnabled).toBeTrue();

    component.disableTwoFactor();
    expect(component.twoFactorEnabled).toBeFalse();
  });

  it('disables enable CTA when passkey linking is off', () => {
    Object.defineProperty(security, 'passkeyLinkEnabled', {
      get: () => false,
    });
    expect(component.canEnablePasskey).toBeFalse();
  });
});
