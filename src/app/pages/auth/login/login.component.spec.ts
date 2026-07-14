import { convertToParamMap, ParamMap } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let router: jasmine.SpyObj<{
    navigateByUrl: (url: string) => Promise<boolean>;
  }>;
  let queryParamMap: ParamMap;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['login'],
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
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    queryParamMap = convertToParamMap({});
    router.navigateByUrl.and.resolveTo(true);
    authSession.login.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    });

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

  it('shows passkey, google, apple, and telegram social options', () => {
    expect(component.socialMethods).toEqual([
      'passkey',
      'google',
      'apple',
      'telegram',
    ]);
  });

  it('hides passkey when passkey login is disabled', () => {
    Object.defineProperty(authSession, 'passkeyLoginEnabled', {
      configurable: true,
      get: () => false,
    });

    expect(component.socialMethods).toEqual(['google', 'apple', 'telegram']);
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
