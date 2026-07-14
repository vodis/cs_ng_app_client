/// <reference types="jasmine" />

import { BehaviorSubject, of } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let sessionSubject: BehaviorSubject<AuthSession | null>;

  const enabledSession: AuthSession = {
    user: {
      id: 'account-1',
      providerUserId: 'provider-1',
      sessionId: 'session-1',
      email: 'user@example.com',
      authMethod: 'email',
      passkeyEnabled: true,
    },
    wallets: [],
  };

  const disabledSession: AuthSession = {
    user: {
      ...enabledSession.user,
      passkeyEnabled: false,
    },
    wallets: [],
  };

  beforeEach(() => {
    sessionSubject = new BehaviorSubject<AuthSession | null>(disabledSession);
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      [
        'enablePasskey',
        'reloadWallets',
        'loadBalances',
        'setPrimaryWallet',
        'deleteWallet',
        'requestDeletion',
        'logout',
      ],
      {
        session$: sessionSubject.asObservable(),
        loading$: of(false),
        passkeyLinkEnabled: true,
      }
    );
    authSession.enablePasskey.and.resolveTo(enabledSession);
    authSession.loadBalances.and.resolveTo([]);

    component = new ProfileComponent(authSession);
    component.ngOnInit();
  });

  it('allows enabling passkey when it is not enabled', async () => {
    expect(component.canEnablePasskey()).toBeTrue();

    await component.enablePasskey();

    expect(authSession.enablePasskey).toHaveBeenCalledTimes(1);
    expect(component.passkeyMessage).toBe('Passkey authentication enabled');
  });

  it('hides passkey enablement when linking is disabled', () => {
    Object.defineProperty(authSession, 'passkeyLinkEnabled', {
      configurable: true,
      get: () => false,
    });

    expect(component.canEnablePasskey()).toBeFalse();
  });
});
