import { convertToParamMap } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { TermsAcceptanceService } from '@core/auth/terms-acceptance.service';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import {
  navigateAfterAuth,
  readReturnUrl,
  resolvePostAuthDestination,
  safeReturnUrl,
} from './auth-navigation.helper';

describe('auth-navigation.helper', () => {
  it('accepts only same-origin relative return URLs', () => {
    expect(safeReturnUrl('/farm')).toBe('/farm');
    expect(safeReturnUrl('//evil.example')).toBe('/');
    expect(safeReturnUrl(null)).toBe('/');
    expect(readReturnUrl(convertToParamMap({ returnUrl: '/portfolio' }))).toBe(
      '/portfolio'
    );
  });

  it('sends wallet-less sessions to profile', async () => {
    const authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['reloadWallets']
    );
    authSession.reloadWallets.and.resolveTo([]);

    await expectAsync(
      resolvePostAuthDestination(authSession, 0, '/farm')
    ).toBeResolvedTo('/profile');
  });

  it('keeps returnUrl when wallets are already linked', async () => {
    const authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['reloadWallets']
    );

    await expectAsync(
      resolvePostAuthDestination(authSession, 1, '/farm')
    ).toBeResolvedTo('/farm');
    expect(authSession.reloadWallets).not.toHaveBeenCalled();
  });

  it('routes through terms when the current version is not accepted', async () => {
    const authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['reloadWallets'],
      {
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
    authSession.reloadWallets.and.resolveTo([]);
    const termsAcceptance = jasmine.createSpyObj<TermsAcceptanceService>(
      'TermsAcceptanceService',
      ['hasAcceptedCurrent']
    );
    termsAcceptance.hasAcceptedCurrent.and.returnValue(false);
    const router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    const localizedRouting = jasmine.createSpyObj<LocalizedRoutingService>(
      'LocalizedRoutingService',
      ['path']
    );
    localizedRouting.path.and.callFake(path =>
      path === '/' ? '/en' : `/en${path}`
    );

    await navigateAfterAuth({
      authSession,
      termsAcceptance,
      router: router as never,
      localizedRouting,
      initialWalletCount: 0,
      returnUrl: '/farm',
    });

    expect(router.navigateByUrl).toHaveBeenCalledOnceWith(
      '/en/terms?returnUrl=%2Fen%2Fprofile'
    );
  });

  it('skips terms when the current version is already accepted', async () => {
    const authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['reloadWallets'],
      {
        session: {
          user: {
            id: 'account-1',
            providerUserId: 'provider-user-1',
            sessionId: 'session-1',
          },
          wallets: [
            {
              id: 'wallet-1',
              providerWalletId: 'wallet-1',
              address: '0x1',
              chainType: 'ethereum',
              walletType: 'embedded',
              isPrimary: true,
            },
          ],
        },
      }
    );
    const termsAcceptance = jasmine.createSpyObj<TermsAcceptanceService>(
      'TermsAcceptanceService',
      ['hasAcceptedCurrent']
    );
    termsAcceptance.hasAcceptedCurrent.and.returnValue(true);
    const router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    const localizedRouting = jasmine.createSpyObj<LocalizedRoutingService>(
      'LocalizedRoutingService',
      ['path']
    );
    localizedRouting.path.and.callFake(path =>
      path === '/' ? '/en' : `/en${path}`
    );

    await navigateAfterAuth({
      authSession,
      termsAcceptance,
      router: router as never,
      localizedRouting,
      initialWalletCount: 1,
      returnUrl: '/farm',
    });

    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/en/farm');
  });
});
