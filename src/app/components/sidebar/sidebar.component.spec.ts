import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SidebarComponent } from './sidebar.component';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [SidebarComponent],
      providers: [
        {
          provide: LocalizedRoutingService,
          useValue: {
            path: (path: string) => `/en${path === '/' ? '' : path}`,
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
      ...component.sidebarBoardLinks,
      ...component.sidebarFinansialLinks,
      ...component.sidebarWorkProposalLinks,
      ...component.sidebarMobile,
    ].map(link => link.url);

    expect(sidebarUrls).not.toContain('/profile');
  });
});
