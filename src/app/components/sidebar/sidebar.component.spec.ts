import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import {
  CsTranslationsModule,
  CsTranslationsService,
} from '@vodis/cs-foundation/angular';

import { SidebarComponent } from './sidebar.component';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(() => {
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

    TestBed.configureTestingModule({
      imports: [RouterTestingModule, CsTranslationsModule],
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

  it('exposes one-word desktop destinations without profile', () => {
    expect(component.menuItems.map(item => item.fallback)).toEqual([
      'Portfolio',
      'Trade',
      'Transactions',
    ]);
    expect(component.menuItems.map(item => item.url)).not.toContain('/profile');
  });

  it('draws interior lines and keeps the menu hidden until they finish', () => {
    const lines: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.sidebar__line');

    expect(lines.length).toBe(4);
    expect(component.menuReady).toBeFalse();
    expect(fixture.nativeElement.querySelector('.sidebar__nav')).toBeNull();

    component.onLineAnimationEnd(1);
    fixture.detectChanges();

    expect(component.menuReady).toBeFalse();

    component.onLineAnimationEnd(4);
    fixture.detectChanges();

    expect(component.menuReady).toBeTrue();
    expect(fixture.nativeElement.querySelector('.sidebar__nav')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.sidebar__line').length
    ).toBe(4);
    expect(
      fixture.nativeElement.querySelector('.sidebar__watermark')
    ).toBeNull();
  });

  it('replays the line animation and hides the menu on navigation', () => {
    component.onLineAnimationEnd(4);
    fixture.detectChanges();

    expect(component.menuReady).toBeTrue();
    expect(fixture.nativeElement.querySelector('.sidebar__nav')).not.toBeNull();

    component.replayAnimation();
    fixture.detectChanges();

    expect(component.menuReady).toBeFalse();
    expect(fixture.nativeElement.querySelector('.sidebar__nav')).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.sidebar__line').length
    ).toBe(4);
  });
});
