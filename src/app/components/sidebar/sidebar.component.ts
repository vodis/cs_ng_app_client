import { Component, HostBinding, Inject, Input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

export type SidebarMobileLink = {
  name: string;
  fallback: string;
  url: string;
  icon: string;
  exact?: boolean;
};

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['sidebar.component.scss'],
})
export class SidebarComponent {
  @Input() isMobileView = false;
  @Input() navCompact = false;

  @HostBinding('class.sidebar-host--nav-compact')
  get hostNavCompact(): boolean {
    return this.isMobileView && this.navCompact;
  }

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

  /** App mobile bottom nav — matches design: Home / Swap / History / Portfolio */
  public sidebarMobile: SidebarMobileLink[] = [
    {
      name: 'Texts.sidebar-home',
      fallback: 'Home',
      url: '/home',
      icon: 'home',
      exact: true,
    },
    {
      name: 'Texts.sidebar-swap',
      fallback: 'Swap',
      url: '/',
      icon: 'swap_horiz',
      exact: true,
    },
    {
      name: 'Texts.sidebar-history',
      fallback: 'History',
      url: '/history',
      icon: 'history',
      exact: true,
    },
    {
      name: 'Texts.sidebar-portfolio',
      fallback: 'Portfolio',
      url: '/portfolio',
      icon: 'pie_chart',
      exact: true,
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

  public mobilePath(url: string): string {
    return this.localizedRouting.path(url);
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
