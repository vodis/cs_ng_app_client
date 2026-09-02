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

    routerEvents.next(new NavigationEnd(2, '/register', '/register'));

    expect(component.hideShell).toBeTrue();

    routerEvents.next(new NavigationEnd(3, '/', '/'));

    expect(component.hideShell).toBeFalse();
  });

  it('does not restart the vertical divider animation on in-app navigation', () => {
    component.onVerticalLineAnimationComplete();

    expect(component.verticalLineAnimating).toBeFalse();

    routerEvents.next(new NavigationEnd(4, '/en/portfolio', '/en/portfolio'));

    expect(component.verticalLineAnimating).toBeFalse();
  });
});
