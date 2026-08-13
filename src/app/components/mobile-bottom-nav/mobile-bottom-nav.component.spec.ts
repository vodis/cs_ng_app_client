import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, CsTranslationsModule, MatIconModule],
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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not expose profile in mobile navigation', () => {
    expect(component.links.map(link => link.url)).not.toContain('/profile');
  });

  it('renders Home, Swap, History, and Portfolio', () => {
    expect(component.links.map(link => link.fallback)).toEqual([
      'Home',
      'Swap',
      'History',
      'Portfolio',
    ]);

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.mobile-bottom-nav__label'
      ) as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());

    expect(labels).toEqual(['Home', 'Swap', 'History', 'Portfolio']);
  });

  it('applies compact class when navCompact is true', () => {
    component.navCompact = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain(
      'mobile-bottom-nav-host--compact'
    );
  });
});
