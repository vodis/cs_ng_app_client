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
    document.documentElement.classList.remove('auth-shell-route');

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

  afterEach(() => {
    document.documentElement.classList.remove('auth-shell-route');
  });

  it('hides shell on auth routes when navigation completes', () => {
    routerEvents.next(new NavigationEnd(1, '/login', '/login'));

    expect(component.hideShell).toBeTrue();
    expect(
      document.documentElement.classList.contains('auth-shell-route')
    ).toBeTrue();

    routerEvents.next(new NavigationEnd(2, '/', '/'));

    expect(component.hideShell).toBeFalse();
    expect(
      document.documentElement.classList.contains('auth-shell-route')
    ).toBeFalse();
  });
});
