import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { HeaderComponent } from './header.component';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  const session: AuthSession = {
    user: {
      id: 'account-1',
      providerUserId: 'provider-1',
      email: 'user@example.com',
      authMethod: 'email',
      passkeyEnabled: false,
    },
    wallets: [],
  };

  function setup(sessionValue: AuthSession | null): void {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, MatIconModule],
      declarations: [HeaderComponent],
      providers: [
        {
          provide: AuthSessionService,
          useValue: {
            session$: of(sessionValue),
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
});
