import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { LayoutComponent } from './layout.component';

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let routerEvents: Subject<unknown>;

  beforeEach(() => {
    routerEvents = new Subject();

    TestBed.configureTestingModule({
      declarations: [LayoutComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: Router,
          useValue: {
            url: '/',
            events: routerEvents.asObservable(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hides shell on auth routes when navigation completes', () => {
    routerEvents.next(new NavigationEnd(1, '/login', '/login'));

    expect(component.hideShell).toBeTrue();

    routerEvents.next(
      new NavigationEnd(2, '/generate-wallet', '/generate-wallet')
    );

    expect(component.hideShell).toBeTrue();

    routerEvents.next(new NavigationEnd(3, '/', '/'));

    expect(component.hideShell).toBeFalse();
  });

  it('compacts mobile nav when scrolling down and expands when scrolling up', () => {
    component.isMobileView = true;
    component.hideShell = false;

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 10,
    });
    component.onWindowScroll();
    expect(component.mobileNavCompact).toBeFalse();

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 30,
    });
    component.onWindowScroll();
    expect(component.mobileNavCompact).toBeTrue();

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 15,
    });
    component.onWindowScroll();
    expect(component.mobileNavCompact).toBeFalse();
  });
});
