import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import {
  CsTranslationsModule,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';
import { of } from 'rxjs';

import { AuthSessionService } from '@core/auth/auth-session.service';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { MobileBottomNavComponent } from './mobile-bottom-nav.component';

describe('MobileBottomNavComponent', () => {
  let component: MobileBottomNavComponent;
  let fixture: ComponentFixture<MobileBottomNavComponent>;
  let router: Router;
  let authSession: jasmine.SpyObj<AuthSessionService>;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['logout']
    );
    authSession.logout.and.resolveTo();

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: 'home', redirectTo: '' },
          { path: 'en', children: [{ path: '**', redirectTo: '' }] },
          { path: 'ua', children: [{ path: '**', redirectTo: '' }] },
          { path: 'farm', redirectTo: '' },
        ]),
        CsTranslationsModule,
      ],
      declarations: [MobileBottomNavComponent],
      providers: [
        {
          provide: LocalizedRoutingService,
          useValue: {
            path: (path: string) => `/en${path === '/' ? '' : path}`,
            currentLocale: () => 'en',
          },
        },
        {
          provide: CsTranslationsService,
          useValue: {
            activeLanguage: 'EN',
            loadLanguage: jasmine
              .createSpy('loadLanguage')
              .and.returnValue(of(undefined)),
            translate: (path: string, fallback?: string) => fallback ?? path,
          },
        },
        { provide: AuthSessionService, useValue: authSession },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(MobileBottomNavComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a flat slide-in list without the More submenu', () => {
    expect(component.links.map(link => link.fallback)).toEqual([
      'Exchange',
      'Profile',
      'Transactions',
      'Portfolio',
      'Grow',
      'Bots',
      'Craftscript.com',
      'Docs',
    ]);
    expect(
      fixture.nativeElement.querySelector('.floating-nav__level--more')
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.slide-nav')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#floatingNav')).toBeTruthy();
  });

  it('keeps visible internal destinations unique', () => {
    const destinations = component.internalDestinations();

    expect(destinations).toEqual([
      '/',
      '/profile',
      '/transactions',
      '/portfolio',
      '/farm',
      '/proposals',
    ]);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it('renders uppercase nav links and language controls', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.slide-nav__label'
      ) as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());

    expect(labels).toContain('Exchange');
    expect(labels).toContain('Profile');
    expect(labels).toContain('Docs');

    const locales = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.slide-nav__locale'
      ) as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());
    expect(locales).toEqual(['EN', 'UA', 'PT']);
    expect(
      fixture.nativeElement.querySelector('.slide-nav__logout')?.textContent
    ).toContain('Logout');
  });

  it('marks the panel inert when closed and focusable when open', () => {
    const panel = fixture.nativeElement.querySelector(
      '#floatingNav'
    ) as HTMLElement;

    expect(panel.hasAttribute('inert')).toBeTrue();

    component.toggleMenu();
    fixture.detectChanges();

    expect(panel.hasAttribute('inert')).toBeFalse();
  });

  it('keeps the panel scrollable for short viewports', () => {
    const viewport = fixture.nativeElement.querySelector(
      '.slide-nav__viewport'
    ) as HTMLElement;
    const styles = getComputedStyle(viewport);

    expect(styles.overflowY).toBe('auto');
  });

  it('opens and closes the slide-in menu', () => {
    expect(component.menuOpen).toBeFalse();

    component.toggleMenu();
    fixture.detectChanges();

    expect(component.menuOpen).toBeTrue();
    expect(fixture.nativeElement.classList).toContain('menu-open');
    expect(document.body.style.overflow).toBe('hidden');

    component.closeMenu();
    fixture.detectChanges();

    expect(component.menuOpen).toBeFalse();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes on Escape and restores trigger focus request path', () => {
    component.toggleMenu();
    fixture.detectChanges();
    expect(component.menuOpen).toBeTrue();

    component.onEscape();
    expect(component.menuOpen).toBeFalse();
  });

  it('starts closed after being recreated like a mobile remount', () => {
    component.toggleMenu();
    fixture.detectChanges();
    expect(component.menuOpen).toBeTrue();

    fixture.destroy();

    const remounted = TestBed.createComponent(MobileBottomNavComponent);
    remounted.detectChanges();

    expect(remounted.componentInstance.menuOpen).toBeFalse();
    remounted.destroy();
  });

  it('moves focus into the panel when the menu opens', fakeAsync(() => {
    component.toggleMenu();
    fixture.detectChanges();
    tick();

    const active = document.activeElement as HTMLElement | null;
    expect(active?.closest('.slide-nav')).toBeTruthy();
  }));

  it('closes the menu after navigation', async () => {
    component.toggleMenu();
    await router.navigateByUrl('/home');

    expect(component.menuOpen).toBeFalse();
  });

  it('logs out through the auth session', async () => {
    await component.logout();
    expect(authSession.logout).toHaveBeenCalledTimes(1);
  });

  it('closes on a right swipe gesture', () => {
    component.toggleMenu();
    fixture.detectChanges();

    component.onTouchStart({
      touches: [{ clientX: 40, clientY: 200 }],
    } as unknown as TouchEvent);
    component.onTouchEnd({
      changedTouches: [{ clientX: 160, clientY: 205 }],
    } as unknown as TouchEvent);

    expect(component.menuOpen).toBeFalse();
  });
});
