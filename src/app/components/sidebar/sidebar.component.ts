import { Component, Inject, Input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['sidebar.component.scss'],
})
export class SidebarComponent {
  @Input() isMobileView = false;

  public isBoardPanelOpen = true;
  public isFarmPanelOpen = true;
  public isDevActivityPanelOpen = true;

  public sidebarBoardLinks = [
    {
      name: 'Texts.sidebar-board',
      fallback: 'Board',
      url: '/',
      isActive: true,
    },
  ];

  public sidebarFinansialLinks = [
    {
      name: 'Texts.sidebar-farm',
      fallback: 'Farm',
      url: '/farm',
      isActive: true,
    },
  ];

  public sidebarWorkProposalLinks = [
    {
      name: 'Texts.sidebar-proposals',
      fallback: 'Proposals',
      url: '/proposals',
      isActive: true,
    },
  ];

  public sidebarMobile = [
    ...this.sidebarBoardLinks,
    ...this.sidebarFinansialLinks,
    ...this.sidebarWorkProposalLinks,
  ];

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private router: Router,
    private readonly localizedRouting: LocalizedRoutingService
  ) {}

  public trackById(index: number): number {
    return index;
  }

  public handleRouteChanging(url: string): void {
    this.router.navigateByUrl(this.localizedRouting.path(url));
    this.document.body.classList.toggle('_is-locked');
  }

  public handleToggleAccordion(
    key: 'isFarmPanelOpen' | 'isDevActivityPanelOpen' | 'isBoardPanelOpen',
    value: boolean
  ): void {
    this[key] = value;
  }
}
