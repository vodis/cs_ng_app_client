import { convertToParamMap, ParamMap, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { of } from 'rxjs';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let router: jasmine.SpyObj<Router>;
  let queryParamMap: ParamMap;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['login', 'sendEmailCode', 'verifyEmailCode', 'reloadWallets'],
      {
        providerSnapshot$: of({
          status: 'ready' as const,
          loginMethods: ['email' as const],
          passkeyLoginEnabled: false,
          passkeySignupEnabled: false,
          passkeyLinkEnabled: true,
          embeddedWalletEnabled: true,
        }),
      }
    );
    authSession.sendEmailCode.and.resolveTo();
    authSession.verifyEmailCode.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
        email: 'user@example.com',
        authMethod: 'email',
      },
      wallets: [],
    });
    router = jasmine.createSpyObj<Router>('Router', [
      'navigateByUrl',
      'navigate',
    ]);
    queryParamMap = convertToParamMap({});
    router.navigateByUrl.and.resolveTo(true);
    router.navigate.and.resolveTo(true);
    authSession.reloadWallets.and.resolveTo([]);

    component = new RegisterComponent(authSession, router, {
      snapshot: { queryParamMap },
    } as never);
  });

  it('requires a valid email and accepted policy before email registration', async () => {
    await component.registerWithEmail();

    expect(component.error).toBe('Email is required.');
    expect(authSession.sendEmailCode).not.toHaveBeenCalled();

    component.email = 'not-an-email';
    await component.registerWithEmail();

    expect(component.error).toBe('Enter a valid email address.');
    expect(authSession.sendEmailCode).not.toHaveBeenCalled();

    component.email = 'user@example.com';
    await component.registerWithEmail();

    expect(component.error).toBe('Please accept the policy to continue.');
    expect(authSession.sendEmailCode).not.toHaveBeenCalled();
  });

  it('sends an email code and opens the verification modal', async () => {
    component.email = 'user@example.com';
    component.agreedToPolicy = true;

    await component.registerWithEmail();

    expect(authSession.sendEmailCode).toHaveBeenCalledOnceWith(
      'user@example.com'
    );
    expect(component.codeEmail).toBe('user@example.com');
    expect(component.isOpenEmailCodeModal).toBeTrue();
  });

  it('routes verified accounts without wallets to generate-wallet', async () => {
    component.codeEmail = 'user@example.com';
    component.emailCode = '123456';

    await component.verifyEmailCode();

    expect(authSession.verifyEmailCode).toHaveBeenCalledOnceWith(
      'user@example.com',
      '123456'
    );
    expect(component.isOpenEmailCodeModal).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/generate-wallet'], {
      queryParams: { returnUrl: '/' },
    });
  });

  it('navigates to a safe return URL when login already has wallets', async () => {
    queryParamMap = convertToParamMap({ returnUrl: '/farm' });
    component = createComponent();
    component.agreedToPolicy = true;
    authSession.login.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
      wallets: [
        {
          id: 'wallet-1',
          providerWalletId: 'wallet-1',
          address: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          walletType: 'embedded',
          isPrimary: true,
        },
      ],
    });

    await component.continueWith('google');

    expect(authSession.login).toHaveBeenCalledOnceWith('google');
    expect(authSession.reloadWallets).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/farm');
  });

  it('routes wallet-less social registration to generate-wallet', async () => {
    component.agreedToPolicy = true;
    authSession.login.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    });

    await component.continueWith('apple');

    expect(authSession.reloadWallets).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/generate-wallet'], {
      queryParams: { returnUrl: '/' },
    });
  });

  function createComponent(): RegisterComponent {
    return new RegisterComponent(authSession, router, {
      snapshot: { queryParamMap },
    } as never);
  }
});
