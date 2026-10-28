import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { AuthProviderService } from './auth-provider.service';
import { AuthSessionService } from './auth-session.service';
import { TermsAcceptanceService } from './terms-acceptance.service';
import { TermsGuard } from './terms.guard';

@Component({
  standalone: true,
  template: 'login',
})
class LoginStubComponent {}

@Component({
  standalone: true,
  template: 'terms',
})
class TermsStubComponent {}

/**
 * Mirrors the production unprefixed `/login` redirect, which replaces the
 * URL with a localized path and drops query parameters.
 */
const routes: Routes = [
  {
    path: 'login',
    pathMatch: 'full',
    redirectTo: '/en/login',
  },
  {
    path: 'en',
    children: [
      {
        path: 'login',
        component: LoginStubComponent,
      },
      {
        path: 'terms',
        component: TermsStubComponent,
        canActivate: [TermsGuard],
      },
    ],
  },
];

describe('TermsGuard router integration', () => {
  let router: Router;
  let authSession: jasmine.SpyObj<AuthSessionService>;
  let authProvider: jasmine.SpyObj<AuthProviderService>;

  beforeEach(async () => {
    localStorage.removeItem('active-language');

    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['refresh'],
      { session: null }
    );
    authProvider = jasmine.createSpyObj<AuthProviderService>(
      'AuthProviderService',
      ['whenSettled']
    );
    authProvider.whenSettled.and.resolveTo({
      status: 'disabled',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
    });

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthSessionService, useValue: authSession },
        { provide: AuthProviderService, useValue: authProvider },
        {
          provide: TermsAcceptanceService,
          useValue: jasmine.createSpyObj<TermsAcceptanceService>(
            'TermsAcceptanceService',
            ['hasAcceptedCurrent']
          ),
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
  });

  it('keeps returnUrl when a guest hits /en/terms', async () => {
    await router.navigateByUrl('/en/terms?returnUrl=%2Fen%2Fportfolio');

    expect(router.url).toBe('/en/login?returnUrl=%2Fen%2Fportfolio');
  });
});
