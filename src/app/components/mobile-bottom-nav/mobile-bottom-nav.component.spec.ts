import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RouterTestingModule } from '@angular/router/testing';
import {
  CsTranslationsModule,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';

import { MobileBottomNavComponent } from './mobile-bottom-nav.component';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

describe('MobileBottomNavComponent', () => {
  let component: MobileBottomNavComponent;
  let fixture: ComponentFixture<MobileBottomNavComponent>;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: 'home', redirectTo: '' },
          { path: 'farm', redirectTo: '' },
        ]),
        CsTranslationsModule,
        MatIconModule,
      ],
      declarations: [MobileBottomNavComponent],
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

  it('keeps the first level to Home, Exchange, Portfolio, and More', () => {
    expect(component.links.map(link => link.fallback)).toEqual([
      'Home',
      'Exchange',
      'Portfolio',
      'More',
    ]);
    expect(component.links.map(link => link.url)).not.toContain('/history');
    expect(component.links.map(link => link.url)).not.toContain('/profile');
  });

  it('renders a persistent floating button instead of a bottom bar', () => {
    expect(
      fixture.nativeElement.querySelector('.floating-trigger')
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.bottom-bar')).toBeNull();
  });

  it('renders the four primary destinations', () => {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.floating-nav__level--primary .nav-label'
      ) as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());

    expect(labels).toEqual(['Home', 'Exchange', 'Portfolio', 'More']);
  });

  it('keeps visible internal destinations unique', () => {
    const destinations = component.internalDestinations();

    expect(destinations).toEqual([
      '/home',
      '/',
      '/portfolio',
      '/farm',
      '/proposals',
      '/history',
      '/profile',
    ]);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it('opens More as a second level without leaving the current page', () => {
    component.toggleMenu();
    fixture.detectChanges();
    component.openMore();
    fixture.detectChanges();

    expect(component.moreOpen).toBeTrue();
    expect(fixture.nativeElement.classList).toContain('more-open');
    expect(component.moreLinks.map(link => link.fallback)).toEqual([
      'Grow',
      'Bots',
      'History',
      'Settings',
      'Craftscript.com',
      'Docs',
    ]);

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.floating-nav__level--more .nav-label'
      ) as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());

    expect(labels).toEqual([
      'Back',
      'Grow',
      'Bots',
      'History',
      'Settings',
      'Craftscript.com',
      'Docs',
    ]);
  });

  it('marks the inactive level as inert so it stays out of tab order', () => {
    component.toggleMenu();
    fixture.detectChanges();

    const primary = fixture.nativeElement.querySelector(
      '.floating-nav__level--primary'
    ) as HTMLElement;
    const more = fixture.nativeElement.querySelector(
      '.floating-nav__level--more'
    ) as HTMLElement;

    expect(primary.hasAttribute('inert')).toBeFalse();
    expect(more.hasAttribute('inert')).toBeTrue();

    component.openMore();
    fixture.detectChanges();

    expect(primary.hasAttribute('inert')).toBeTrue();
    expect(more.hasAttribute('inert')).toBeFalse();
  });

  it('keeps the floating panel scrollable for short viewports', () => {
    const viewport = fixture.nativeElement.querySelector(
      '.floating-nav__viewport'
    ) as HTMLElement;
    const styles = getComputedStyle(viewport);

    expect(styles.overflowY).toBe('auto');
  });

  it('returns to the first level from Back and Escape', () => {
    component.toggleMenu();
    component.openMore();
    fixture.detectChanges();

    component.closeMore();
    expect(component.moreOpen).toBeFalse();
    expect(component.menuOpen).toBeTrue();

    component.openMore();
    component.onEscape();
    expect(component.moreOpen).toBeFalse();
    expect(component.menuOpen).toBeTrue();

    component.onEscape();
    expect(component.menuOpen).toBeFalse();
  });

  it('opens and closes the floating menu', () => {
    expect(component.menuOpen).toBeFalse();

    component.toggleMenu();
    fixture.detectChanges();

    expect(component.menuOpen).toBeTrue();
    expect(fixture.nativeElement.classList).toContain('menu-open');

    component.closeMenu();
    fixture.detectChanges();

    expect(component.menuOpen).toBeFalse();
    expect(component.moreOpen).toBeFalse();
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

  it('moves focus into the active level when the menu opens', fakeAsync(() => {
    component.toggleMenu();
    fixture.detectChanges();
    tick();

    const active = document.activeElement as HTMLElement | null;
    expect(active?.closest('.floating-nav__level--primary')).toBeTruthy();
  }));

  it('closes the menu after navigation', async () => {
    component.toggleMenu();
    component.openMore();
    await router.navigateByUrl('/home');

    expect(component.menuOpen).toBeFalse();
    expect(component.moreOpen).toBeFalse();
  });
});
