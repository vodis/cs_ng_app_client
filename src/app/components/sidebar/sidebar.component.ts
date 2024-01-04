import { Component, Input, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['sidebar.component.scss'],
})
export class SidebarComponent {
  @Input() isMobileView = false;

  public sidebarLinks = [
    {
      name: 'Farming',
      url: '/farm',
      isActive: true,
    },
    {
      name: 'Earning',
      url: '/earn',
      isActive: false,
    },
  ];

  constructor(@Inject(DOCUMENT) private document: Document) {}

  public trackById(index: number): number {
    return index;
  }

  public handleRouteChanging(): void {
    this.document.body.classList.toggle('_is-locked');
  }
}
