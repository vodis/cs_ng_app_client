import { convertToParamMap, ParamMap, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { TermsAcceptanceService } from '@core/auth/terms-acceptance.service';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { of } from 'rxjs';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let termsAcceptance: jasmine.SpyObj<TermsAcceptanceService>;
  let router: jasmine.SpyObj<Router>;
  let localizedRouting: jasmine.SpyObj<LocalizedRoutingService>;
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
        session: {
          user: {
            id: 'account-1',
            providerUserId: 'provider-user-1',
            sessionId: 'session-1',
          },
          wallets: [],
        },
      }
    );
    termsAcceptance = jasmine.createSpyObj<TermsAcceptanceService>(
      'TermsAcceptanceService',
      ['hasAcceptedCurrent']
    );
    termsAcceptance.hasAcceptedCurrent.and.returnValue(true);
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
    localizedRouting = jasmine.createSpyObj<LocalizedRoutingService>(
      'LocalizedRoutingService',
      ['path']
    );
    localizedRouting.path.and.callFake(path =>
      path === '/' ? '/en' : `/en${path}`
    );

    component = createComponent();
  });

  it('requires a valid email before email registration', async () => {
    await component.registerWithEmail();

    expect(component.error).toBe('Email is required.');
    expect(authSession.sendEmailCode).not.toHaveBeenCalled();

    component.email = 'not-an-email';
    await component.registerWithEmail();

    expect(component.error).toBe('Enter a valid email address.');
    expect(authSession.sendEmailCode).not.toHaveBeenCalled();
  });

  it('sends an email code and opens the verification modal', async () => {
    component.email = 'user@example.com';

    await component.registerWithEmail();

    expect(authSession.sendEmailCode).toHaveBeenCalledOnceWith(
      'user@example.com'
    );
    expect(component.codeEmail).toBe('user@example.com');
    expect(component.isOpenEmailCodeModal).toBeTrue();
  });

  it('routes verified accounts through Terms when acceptance is required', async () => {
    termsAcceptance.hasAcceptedCurrent.and.returnValue(false);
    component.codeEmail = 'user@example.com';
    component.emailCode = '123456';

    await component.verifyEmailCode();

    expect(authSession.verifyEmailCode).toHaveBeenCalledOnceWith(
      'user@example.com',
      '123456'
    );
    expect(component.isOpenEmailCodeModal).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith(
      '/en/terms?returnUrl=%2Fen%2Fprofile'
    );
  });

  it('navigates to a safe return URL when Terms are already accepted', async () => {
    queryParamMap = convertToParamMap({ returnUrl: '/farm' });
    component = createComponent();
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
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/en/farm');
  });

  it('routes social registration through Terms when acceptance is required', async () => {
    termsAcceptance.hasAcceptedCurrent.and.returnValue(false);
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
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith(
      '/en/terms?returnUrl=%2Fen%2Fprofile'
    );
  });

  function createComponent(): RegisterComponent {
    return new RegisterComponent(
      authSession,
      router,
      {
        snapshot: { queryParamMap },
      } as never,
      localizedRouting,
      termsAcceptance
    );
  }
});
