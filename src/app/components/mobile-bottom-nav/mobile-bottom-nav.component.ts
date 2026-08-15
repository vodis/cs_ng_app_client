import { Component, HostBinding, Input } from '@angular/core';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';

export type MobileBottomNavLink = {
  name: string;
  fallback: string;
  url: string;
  icon: string;
  exact?: boolean;
};

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: false,
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
})
export class MobileBottomNavComponent {
  @Input() navCompact = false;

  @HostBinding('class.mobile-bottom-nav-host--compact')
  get hostNavCompact(): boolean {
    return this.navCompact;
  }

  public readonly links: MobileBottomNavLink[] = [
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

  constructor(private readonly localizedRouting: LocalizedRoutingService) {}

  public trackById(index: number): number {
    return index;
  }

  public path(url: string): string {
    return this.localizedRouting.path(url);
  }
}
