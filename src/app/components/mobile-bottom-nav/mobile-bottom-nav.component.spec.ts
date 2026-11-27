import { A11yModule } from '@angular/cdk/a11y';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flushMicrotasks,
  tick,
} from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import {
  CsTranslationsModule,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';
import { CsCloseButtonComponent } from '@vodis/cs-ui/angular';
import { of } from 'rxjs';

import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { SideModalComponent } from '@shared/components/side-modal/side-modal.component';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { BehaviorSubject } from 'rxjs';
import { MobileBottomNavComponent } from './mobile-bottom-nav.component';

describe('MobileBottomNavComponent', () => {
  let component: MobileBottomNavComponent;
  let fixture: ComponentFixture<MobileBottomNavComponent>;
  let router: Router;
  let walletsOpenRequested: BehaviorSubject<boolean>;

  beforeEach(() => {
    walletsOpenRequested = new BehaviorSubject(false);

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: 'home', redirectTo: '' },
          { path: 'en', children: [{ path: '**', redirectTo: '' }] },
          { path: 'ua', children: [{ path: '**', redirectTo: '' }] },
          { path: 'farm', redirectTo: '' },
        ]),
        CsTranslationsModule,
        A11yModule,
        CsCloseButtonComponent,
      ],
      declarations: [MobileBottomNavComponent, SideModalComponent],
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
        {
          provide: WalletsService,
          useValue: {
            openRequested: walletsOpenRequested,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MobileBottomNavComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    document
      .querySelectorAll('app-side-modal')
      .forEach(node => node.remove());
  });

  function dialog(): HTMLElement | null {
    return document.querySelector('.side-modal');
  }

  function panel(): HTMLElement | null {
    return document.querySelector('#floatingNav');
  }

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
    expect(panel()).toBeTruthy();
    expect(document.querySelector('app-side-modal')).toBeTruthy();
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

  it('renders uppercase nav links and language controls without Logout', () => {
    const labels = Array.from(
      document.querySelectorAll('.slide-nav__label') as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());

    expect(labels).toContain('Exchange');
    expect(labels).toContain('Profile');
    expect(labels).toContain('Docs');

    const locales = Array.from(
      document.querySelectorAll('.slide-nav__locale') as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());
    expect(locales).toEqual(['EN', 'UA', 'PT']);
    expect(document.querySelector('.slide-nav__logout')).toBeNull();
  });

  it('opens the shared side slide dialog with Menu title and cs-ui close', () => {
    expect(dialog()?.classList.contains('open')).toBeFalse();

    component.toggleMenu();
    fixture.detectChanges();

    expect(component.menuOpen).toBeTrue();
    expect(dialog()?.classList.contains('open')).toBeTrue();
    expect(
      document.querySelector('.slide-nav__title')?.textContent?.trim()
    ).toBe('Menu');
    expect(dialog()?.getAttribute('aria-labelledby')).toBe(
      'mobile-nav-menu-title'
    );
    expect(document.getElementById('mobile-nav-menu-title')?.tagName).toBe(
      'H2'
    );
    expect(
      document.querySelector('.slide-nav__close button.cs-close-button')
    ).toBeTruthy();
  });

  it('draws a divider after Bots before external links', () => {
    const bots = component.links.find(link => link.fallback === 'Bots');
    expect(bots?.dividerAfter).toBeTrue();
    expect(
      document.querySelector('.slide-nav__item--divider')
    ).toBeTruthy();
  });

  it('keeps languages in one footer row', () => {
    const languages = document.querySelector(
      '.slide-nav__languages'
    ) as HTMLElement;
    expect(getComputedStyle(languages).flexDirection).toBe('row');
  });

  it('marks the side-modal inert when closed and interactive when open', () => {
    const modal = dialog();
    expect(modal).toBeTruthy();
    expect(modal!.hasAttribute('inert')).toBeTrue();

    component.toggleMenu();
    fixture.detectChanges();

    expect(modal!.hasAttribute('inert')).toBeFalse();
  });

  it('keeps the panel scrollable for short viewports', () => {
    const viewport = document.querySelector(
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
    expect(dialog()?.classList.contains('open')).toBeTrue();

    component.closeMenu();
    fixture.detectChanges();

    expect(component.menuOpen).toBeFalse();
    expect(dialog()?.classList.contains('open')).toBeFalse();
  });

  it('closes from the cs-ui close control and can restore trigger focus', () => {
    component.toggleMenu();
    fixture.detectChanges();

    const closeButton = document.querySelector(
      '.slide-nav__close button.cs-close-button'
    ) as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

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

  it('moves focus into the dialog when the menu opens', fakeAsync(() => {
    component.toggleMenu();
    fixture.detectChanges();
    flushMicrotasks();
    tick();

    const active = document.activeElement as HTMLElement | null;
    expect(
      active?.closest('.side-modal') || active?.closest('.slide-nav')
    ).toBeTruthy();
  }));

  it('closes the menu after navigation', async () => {
    component.toggleMenu();
    await router.navigateByUrl('/home');

    expect(component.menuOpen).toBeFalse();
  });

  it('closes navigation when the wallet dialog is requested', () => {
    component.toggleMenu();
    fixture.detectChanges();
    expect(component.menuOpen).toBeTrue();

    walletsOpenRequested.next(true);
    fixture.detectChanges();

    expect(component.menuOpen).toBeFalse();
  });

  it('does not keep a legacy overlay panel', () => {
    expect(document.querySelector('.nav-overlay')).toBeNull();
  });
});
