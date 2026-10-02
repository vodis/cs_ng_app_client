/// <reference types="jasmine" />

import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { HeaderComponent } from './header.component';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import {
  CsTranslationsModule,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let walletsService: { requestOpen: jasmine.Spy };

  const session: AuthSession = {
    user: {
      id: 'account-1',
      providerUserId: 'provider-1',
      sessionId: 'session-1',
      email: 'user@example.com',
      authMethod: 'email',
      passkeyEnabled: false,
    },
    wallets: [],
  };

  function setup(sessionValue: AuthSession | null): void {
    walletsService = {
      requestOpen: jasmine.createSpy('requestOpen'),
    };
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, MatIconModule, CsTranslationsModule],
      declarations: [HeaderComponent],
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            session$: of(sessionValue),
          },
        },
        {
          provide: LocalizedRoutingService,
          useValue: {
            path: (path: string) => `/en${path === '/' ? '' : path}`,
          },
        },
        {
          provide: WalletsService,
          useValue: walletsService,
        },
        {
          provide: CsTranslationsService,
          useValue: {
            translate: (path: string, fallback?: string) => fallback ?? path,
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    setup(null);
    expect(component).toBeTruthy();
  });

  it('shows sign in text when logged out', () => {
    setup(null);
    component.isMobileView = false;
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.header__account-link'
    ) as HTMLElement;

    expect(link.textContent?.trim()).toBe('Sign in');
    expect(link.classList.contains('header__account-link--icon')).toBeFalse();
  });

  it('shows a notifications icon next to the account control', () => {
    setup(session);

    const button = fixture.nativeElement.querySelector(
      'button.header__icon-button[aria-label="Notifications"]'
    ) as HTMLButtonElement;
    const icon = button.querySelector('mat-icon');

    expect(button.getAttribute('type')).toBe('button');
    expect(icon?.textContent?.trim()).toBe('notifications');
    expect(icon?.getAttribute('fontSet')).toBe('material-icons-outlined');
  });

  it('opens the wallets drawer from the header wallet icon', () => {
    setup(session);

    const button = fixture.nativeElement.querySelector(
      'button.header__icon-button[aria-label="Wallets"]'
    ) as HTMLButtonElement;
    const icon = button.querySelector('mat-icon');

    expect(icon?.textContent?.trim()).toBe('account_balance_wallet');
    expect(icon?.getAttribute('fontSet')).toBe('material-icons-outlined');

    button.click();

    expect(walletsService.requestOpen).toHaveBeenCalledOnceWith();
  });

  it('shows account icon when logged in', () => {
    setup(session);

    const link = fixture.nativeElement.querySelector(
      '.header__account-link'
    ) as HTMLAnchorElement;

    expect(link.getAttribute('aria-label')).toBe('Portfolio');
    expect(link.getAttribute('href')).toBe('/en/portfolio');
    expect(link.classList.contains('header__account-link--icon')).toBeTrue();
    expect(link.querySelector('mat-icon')?.textContent?.trim()).toBe('person');
  });

  it('shows account icon on mobile when logged out', () => {
    setup(null);
    component.isMobileView = true;
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.header__account-link'
    ) as HTMLElement;

    expect(link.classList.contains('header__account-link--icon')).toBeTrue();
    expect(link.querySelector('mat-icon')?.textContent?.trim()).toBe('person');
  });

  it('applies mobile host class', () => {
    setup(null);
    component.isMobileView = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('header-host--mobile');
  });
});
