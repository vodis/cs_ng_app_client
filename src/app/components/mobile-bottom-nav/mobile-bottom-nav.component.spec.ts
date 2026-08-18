import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
      'Security',
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
      'Security',
      'Craftscript.com',
      'Docs',
    ]);
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

  it('closes the menu after navigation', async () => {
    component.toggleMenu();
    component.openMore();
    await router.navigateByUrl('/home');

    expect(component.menuOpen).toBeFalse();
    expect(component.moreOpen).toBeFalse();
  });
});
