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
        'disablePasskey',
        'canDisablePasskey',
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
        enabledLoginMethods: ['email', 'passkey'],
      }
    );
    authSession.enablePasskey.and.resolveTo(enabledSession);
    authSession.disablePasskey.and.resolveTo(disabledSession);
    authSession.canDisablePasskey.and.returnValue(true);
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

  it('allows disabling passkey when it is enabled', async () => {
    sessionSubject.next(enabledSession);
    expect(component.canDisablePasskey()).toBeTrue();

    await component.disablePasskey();

    expect(authSession.disablePasskey).toHaveBeenCalledTimes(1);
    expect(component.passkeyMessage).toBe('Passkey authentication disabled');
  });

  it('surfaces passkey disable failures', async () => {
    authSession.disablePasskey.and.rejectWith(new Error('Provider rejected'));

    await component.disablePasskey();

    expect(component.error).toBe('Provider rejected');
  });
});
