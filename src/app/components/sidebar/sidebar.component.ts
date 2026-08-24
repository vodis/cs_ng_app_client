import { Component, Inject } from '@angular/core';
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
  public isBoardPanelOpen = true;
  public isFarmPanelOpen = true;
  public isDevActivityPanelOpen = true;

  public sidebarBoardLinks = [
    {
      name: 'Texts.sidebar-portfolio',
      fallback: 'Portfolio',
      url: '/portfolio',
      isActive: true,
    },
  ];

  public sidebarFinansialLinks = [
    {
      name: 'Texts.sidebar-trade',
      fallback: 'Trade',
      url: '/',
      isActive: true,
    },
  ];

  public sidebarWorkProposalLinks = [
    {
      name: 'Texts.sidebar-transactions',
      fallback: 'Transactions',
      url: '/transactions',
      isActive: true,
    },
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
