import { convertToParamMap, ParamMap, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { of } from 'rxjs';
import { GenerateWalletComponent } from './generate-wallet.component';

describe('GenerateWalletComponent', () => {
  let component: GenerateWalletComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let router: jasmine.SpyObj<Router>;
  let queryParamMap: ParamMap;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['ensureEmbeddedWallet', 'reloadWallets'],
      {
        session: {
          user: {
            id: 'account-1',
            providerUserId: 'provider-user-1',
            sessionId: 'session-1',
          },
          wallets: [],
        },
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
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    queryParamMap = convertToParamMap({});
    router.navigateByUrl.and.resolveTo(true);
    authSession.ensureEmbeddedWallet.and.resolveTo();
    authSession.reloadWallets.and.resolveTo([]);

    component = new GenerateWalletComponent(authSession, router, {
      snapshot: { queryParamMap },
    } as never);
  });

  it('opens only the page-owned wallet connector modal', () => {
    component.connectExistingWallet();

    expect(component.isOpenWalletConnectMenu).toBeTrue();
  });

  it('generates an embedded wallet and navigates after backend wallet refresh', async () => {
    queryParamMap = convertToParamMap({ returnUrl: '//evil.example' });
    component = createComponent();
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

    expect(authSession.ensureEmbeddedWallet).toHaveBeenCalledTimes(1);
    expect(authSession.reloadWallets).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/');
  });

  it('requires a linked wallet before continuing', async () => {
    await component.finishAfterWalletLinked();

    expect(component.error).toBe('Connect or generate a wallet to continue.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('redirects away when wallets already exist', async () => {
    queryParamMap = convertToParamMap({ returnUrl: '/farm' });
    component = createComponent();
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

    await component.ngOnInit();

    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/farm');
  });

  function createComponent(): GenerateWalletComponent {
    return new GenerateWalletComponent(authSession, router, {
      snapshot: { queryParamMap },
    } as never);
  }
});
