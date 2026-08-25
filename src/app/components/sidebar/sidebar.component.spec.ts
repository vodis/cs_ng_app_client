import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
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
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not expose profile in sidebar navigation', () => {
    const sidebarUrls = [
      ...component.informationLinks,
      ...component.financeLinks,
      ...component.activityLinks,
    ].map(link => link.url);

    expect(sidebarUrls).not.toContain('/profile');
  });
});
