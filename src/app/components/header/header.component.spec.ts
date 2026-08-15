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
import {
  CsTranslationsModule,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

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

  it('shows account icon when logged in', () => {
    setup(session);

    const link = fixture.nativeElement.querySelector(
      '.header__account-link'
    ) as HTMLElement;

    expect(link.getAttribute('aria-label')).toBe('Profile');
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
