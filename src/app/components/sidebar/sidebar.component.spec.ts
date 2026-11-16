import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { RouterTestingModule } from '@angular/router/testing';
import {
  CsTranslationsModule,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';

import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { BehaviorSubject } from 'rxjs';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let wallets: jasmine.SpyObj<WalletsService>;
  let session$: BehaviorSubject<AuthSession | null>;

  beforeEach(() => {
    session$ = new BehaviorSubject<AuthSession | null>(null);
    spyOn(window, 'matchMedia').and.returnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    } as MediaQueryList);

    wallets = jasmine.createSpyObj<WalletsService>('WalletsService', [
      'requestOpen',
    ]);

    TestBed.configureTestingModule({
      imports: [RouterTestingModule, CsTranslationsModule, MatIconModule],
      declarations: [SidebarComponent],
      providers: [
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
        {
          provide: AuthSessionService,
          useValue: {
            session$,
          },
        },
        { provide: WalletsService, useValue: wallets },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes icon rail destinations including portfolio', () => {
    expect(component.menuItems.map(item => item.fallback)).toEqual([
      'Profile',
      'Trade',
      'Transactions',
      'Portfolio',
    ]);
    expect(component.menuItems.map(item => item.url)).toContain('/portfolio');
  });

  it('renders real nav links in the initial DOM before the reveal', () => {
    expect(component.iconsVisible).toBeFalse();
    expect(fixture.nativeElement.querySelector('.sidebar__nav')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.sidebar__nav a[href]').length
    ).toBe(4);
    expect(
      fixture.nativeElement.querySelector('.sidebar__logo[href]')
    ).not.toBeNull();
  });

  it('reveals icons after the intro sweep timing', fakeAsync(() => {
    fixture.destroy();
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.lineSweeping).toBeTrue();
    expect(component.iconsVisible).toBeFalse();
    tick(480);
    fixture.detectChanges();
    expect(component.lineSweeping).toBeFalse();
    expect(component.lineSettled).toBeTrue();
    expect(component.iconsVisible).toBeTrue();
    expect(
      fixture.nativeElement.querySelector('.sidebar.sidebar--ready')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.sidebar.sidebar--settled')
    ).not.toBeNull();
  }));

  it('opens wallets from the rail action', () => {
    component.openWallets();
    expect(wallets.requestOpen).toHaveBeenCalledTimes(1);
  });

  it('marks accessible names on icon-only links', () => {
    const profile = fixture.nativeElement.querySelector(
      'a[aria-label="Profile"]'
    );
    expect(profile).not.toBeNull();
    expect(profile.getAttribute('href')).toContain('/profile');
  });

  it('shows a bottom avatar link when signed in', () => {
    session$.next({
      user: {
        id: 'u1',
        providerUserId: 'p1',
        sessionId: 's1',
        email: 'mariia@craftscript.com',
      },
      wallets: [],
    });
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector(
      'a.sidebar__action--avatar'
    );
    expect(avatar).not.toBeNull();
    expect(avatar.getAttribute('href')).toContain('/profile');
    expect(avatar.getAttribute('aria-label')).toBe('Account');
    expect(avatar.getAttribute('title')).toBe('mariia@craftscript.com');
    expect(fixture.nativeElement.querySelector('app-avatar')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('a[aria-label="Sign in"]')
    ).toBeNull();
  });
});
