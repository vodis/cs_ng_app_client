import { convertToParamMap, ParamMap, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { of } from 'rxjs';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let router: jasmine.SpyObj<Router>;
  let walletsService: jasmine.SpyObj<WalletsService>;
  let walletGatewayBridge: jasmine.SpyObj<WalletGatewayBridgeService>;
  let queryParamMap: ParamMap;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['login', 'sendEmailCode', 'verifyEmailCode', 'reloadWallets'],
      {
        providerSnapshot$: of({
          status: 'ready' as const,
          loginMethods: ['email' as const],
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
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    walletsService = jasmine.createSpyObj<WalletsService>('WalletsService', [
      'requestOpen',
    ]);
    walletGatewayBridge = jasmine.createSpyObj<WalletGatewayBridgeService>(
      'WalletGatewayBridgeService',
      ['createEmbeddedWallet']
    );
    queryParamMap = convertToParamMap({});
    router.navigateByUrl.and.resolveTo(true);

    component = new RegisterComponent(
      authSession,
      router,
      { snapshot: { queryParamMap } } as never,
      walletsService,
      walletGatewayBridge
    );
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

  it('verifies email code and moves to wallet setup when no wallets exist', async () => {
    component.codeEmail = 'user@example.com';
    component.emailCode = '123456';
    authSession.reloadWallets.and.resolveTo([]);

    await component.verifyEmailCode();

    expect(authSession.verifyEmailCode).toHaveBeenCalledOnceWith(
      'user@example.com',
      '123456'
    );
    expect(component.isOpenEmailCodeModal).toBeFalse();
    expect(component.step).toBe('wallet');
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

  it('moves to the wallet step when login and refresh return no wallets', async () => {
    component.agreedToPolicy = true;
    authSession.login.and.resolveTo({
      user: {
        id: 'account-1',
        providerUserId: 'provider-user-1',
        sessionId: 'session-1',
      },
      wallets: [],
    });
    authSession.reloadWallets.and.resolveTo([]);

    await component.continueWith('apple');

    expect(authSession.reloadWallets).toHaveBeenCalledTimes(1);
    expect(component.step).toBe('wallet');
    expect(component.info).toBe(
      'Choose how you want to secure your wallet access.'
    );
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('opens the wallet connector from the wallet step', () => {
    component.connectExistingWallet();

    expect(component.isOpenWalletConnectMenu).toBeTrue();
    expect(walletsService.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('generates an embedded wallet and navigates after backend wallet refresh', async () => {
    queryParamMap = convertToParamMap({ returnUrl: '//evil.example' });
    component = createComponent();
    walletGatewayBridge.createEmbeddedWallet.and.resolveTo({
      account: '0x1111111111111111111111111111111111111111',
      chainId: 1,
      walletType: 'embedded',
      source: 'provider',
    });
    authSession.reloadWallets.and.resolveTo([
      {
        id: 'wallet-1',
        providerWalletId: 'wallet-1',
        address: '0x1111111111111111111111111111111111111111',
        chainType: 'ethereum',
        walletType: 'embedded',
        isPrimary: true,
      },
    ]);

    await component.generateWallet();

    expect(walletGatewayBridge.createEmbeddedWallet).toHaveBeenCalledTimes(1);
    expect(authSession.reloadWallets).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/');
  });

  it('requires a linked wallet before finishing wallet onboarding', async () => {
    authSession.reloadWallets.and.resolveTo([]);

    await component.finishAfterWalletLinked();

    expect(component.error).toBe('Connect or generate a wallet to continue.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  function createComponent(): RegisterComponent {
    return new RegisterComponent(
      authSession,
      router,
      { snapshot: { queryParamMap } } as never,
      walletsService,
      walletGatewayBridge
    );
  }
});
