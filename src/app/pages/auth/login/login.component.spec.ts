import { convertToParamMap, ParamMap } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { of } from 'rxjs';
import { PASSKEY_SETUP_REQUIRED_MESSAGE } from '../shared/auth-login-messages.helper';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let router: jasmine.SpyObj<{
    navigateByUrl: (url: string) => Promise<boolean>;
    navigate: (
      commands: string[],
      extras?: { queryParams?: Record<string, string> }
    ) => Promise<boolean>;
  }>;
  let queryParamMap: ParamMap;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['login', 'sendEmailCode', 'verifyEmailCode', 'reloadWallets'],
      {
        providerSnapshot$: of({
          status: 'ready' as const,
          loginMethods: ['email', 'passkey', 'google', 'apple'],
          passkeyLoginEnabled: true,
          passkeySignupEnabled: false,
          passkeyLinkEnabled: true,
          embeddedWalletEnabled: true,
        }),
        enabledLoginMethods: ['email', 'passkey', 'google', 'apple'],
        passkeyLoginEnabled: true,
      }
    );
    router = jasmine.createSpyObj('Router', ['navigateByUrl', 'navigate']);
    queryParamMap = convertToParamMap({});
    router.navigateByUrl.and.resolveTo(true);
    router.navigate.and.resolveTo(true);
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
    authSession.reloadWallets.and.resolveTo([]);

    component = new LoginComponent(
      authSession,
      router as never,
      { snapshot: { queryParamMap } } as never
    );
  });

  it('requires a valid email before email login', async () => {
    await component.loginWithEmail();

    expect(component.error).toBe('Email is required.');
    expect(authSession.login).not.toHaveBeenCalled();

    component.email = 'not-an-email';
    await component.loginWithEmail();

    expect(component.error).toBe('Enter a valid email address.');
    expect(authSession.login).not.toHaveBeenCalled();
  });

  it('logs in with passkey and navigates to a safe return URL', async () => {
    queryParamMap = convertToParamMap({ returnUrl: '/farm' });
    component = createComponent();

    await component.continueWith('passkey');

    expect(authSession.login).toHaveBeenCalledOnceWith('passkey');
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/farm');
  });

  it('shows passkey, google, apple, and telegram social options by default', () => {
    expect(component.socialMethods).toEqual([
      'passkey',
      'google',
      'apple',
      'telegram',
    ]);
  });

  it('shows a helpful message when passkey is not enabled on the account', async () => {
    authSession.login.and.rejectWith(new Error('No passkey credentials found'));

    await component.continueWith('passkey');

    expect(component.error).toBe(PASSKEY_SETUP_REQUIRED_MESSAGE);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('routes wallet-less logins to generate-wallet', async () => {
    authSession.login.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    });
    authSession.reloadWallets.and.resolveTo([]);

    await component.continueWith('google');

    expect(router.navigate).toHaveBeenCalledOnceWith(['/generate-wallet'], {
      queryParams: { returnUrl: '/' },
    });
  });

  it('shows a coming soon message for telegram login', async () => {
    await component.continueWithSocial('telegram');

    expect(component.info).toBe('Telegram login is coming soon.');
    expect(authSession.login).not.toHaveBeenCalled();
  });

  function createComponent(): LoginComponent {
    return new LoginComponent(
      authSession,
      router as never,
      { snapshot: { queryParamMap } } as never
    );
  }
});
