import { convertToParamMap } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { CURRENT_TERMS_VERSION } from '@core/auth/terms-acceptance.constants';
import { TermsAcceptanceService } from '@core/auth/terms-acceptance.service';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { TermsComponent } from './terms.component';

describe('TermsComponent', () => {
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let termsAcceptance: jasmine.SpyObj<TermsAcceptanceService>;
  let router: jasmine.SpyObj<{
    navigateByUrl: (url: string) => Promise<boolean>;
  }>;
  let localizedRouting: jasmine.SpyObj<LocalizedRoutingService>;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['logout'],
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
    termsAcceptance = jasmine.createSpyObj<TermsAcceptanceService>(
      'TermsAcceptanceService',
      ['isVersionUpdate', 'acceptCurrent']
    );
    termsAcceptance.isVersionUpdate.and.returnValue(false);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    localizedRouting = jasmine.createSpyObj<LocalizedRoutingService>(
      'LocalizedRoutingService',
      ['path']
    );
    localizedRouting.path.and.callFake(path =>
      path === '/' ? '/en' : `/en${path}`
    );
  });

  it('uses the first-acceptance title by default', () => {
    const component = createComponent();
    expect(component.title).toBe('Terms and Conditions');
    expect(component.termsVersion).toBe(CURRENT_TERMS_VERSION);
  });

  it('uses the changed title when a prior version exists', () => {
    termsAcceptance.isVersionUpdate.and.returnValue(true);
    const component = createComponent();
    expect(component.title).toBe('Our Terms of Service have changed');
  });

  it('stores acceptance and continues to returnUrl', async () => {
    const component = createComponent('/farm');
    component.canAgree = true;

    await component.agree();

    expect(termsAcceptance.acceptCurrent).toHaveBeenCalledOnceWith('account-1');
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/en/farm');
  });

  it('does not accept before the user can agree', async () => {
    const component = createComponent();
    await component.agree();
    expect(termsAcceptance.acceptCurrent).not.toHaveBeenCalled();
  });

  function createComponent(returnUrl = '/'): TermsComponent {
    return new TermsComponent(
      authSession,
      termsAcceptance,
      router as never,
      {
        snapshot: { queryParamMap: convertToParamMap({ returnUrl }) },
      } as never,
      localizedRouting
    );
  }
});
