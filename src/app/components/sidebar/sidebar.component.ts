import { Component, Inject, Input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['sidebar.component.scss'],
})
export class SidebarComponent {
  @Input() isMobileView = false;

  public isFarmPanelOpen = true;
  public isDevActivityPanelOpen = true;

  public sidebarFinansialLinks = [
    {
      name: 'Farm',
      url: '/farm',
      isActive: true,
    },
  ];

  public sidebarWorkProposalLinks = [
    {
      name: 'Proposals',
      url: '/proposals',
      isActive: true,
    },
  ];

  public sidebarMobile = [
    ...this.sidebarFinansialLinks,
    ...this.sidebarWorkProposalLinks,
  ];

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private router: Router
  ) {}

  public trackById(index: number): number {
    return index;
  }

  public handleRouteChanging(url: string): void {
    this.router.navigateByUrl(url);
    this.document.body.classList.toggle('_is-locked');
  }

  public handleToggleAccordion(
    key: 'isFarmPanelOpen' | 'isDevActivityPanelOpen',
    value: boolean
  ): void {
    this[key] = value;
  }
}
