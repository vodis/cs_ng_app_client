import { Component, HostBinding, HostListener, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import {
  LocalizedRoutingService,
  stripLocalePrefix,
} from '@core/routing/localized-routing.service';
import { environment } from '../../../environments/environment';
import { MobileNavMenuService } from './mobile-nav-menu.service';

export type MobileNavIcon =
  | 'home'
  | 'exchange'
  | 'portfolio'
  | 'more'
  | 'back'
  | 'grow'
  | 'bots'
  | 'history'
  | 'settings'
  | 'security'
  | 'external'
  | 'docs';

export type MobileNavItem = {
  name: string;
  fallback: string;
  icon: MobileNavIcon;
  url?: string;
  href?: string;
  exact?: boolean;
};

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: false,
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss'],
})
export class MobileBottomNavComponent implements OnDestroy {
  public menuOpen = false;
  public moreOpen = false;

  @HostBinding('class.menu-open')
  get hostMenuOpen(): boolean {
    return this.menuOpen;
  }

  @HostBinding('class.more-open')
  get hostMoreOpen(): boolean {
    return this.moreOpen;
  }

  public readonly links: MobileNavItem[] = [
    {
      name: 'Texts.sidebar-home',
      fallback: 'Home',
      url: '/home',
      icon: 'home',
      exact: true,
    },
    {
      name: 'Texts.sidebar-swap',
      fallback: 'Exchange',
      url: '/',
      icon: 'exchange',
      exact: true,
    },
    {
      name: 'Texts.sidebar-portfolio',
      fallback: 'Portfolio',
      url: '/portfolio',
      icon: 'portfolio',
      exact: true,
    },
    {
      name: 'Texts.sidebar-more',
      fallback: 'More',
      icon: 'more',
    },
  ];

  public readonly moreLinks: MobileNavItem[] = [
    {
      name: 'Texts.sidebar-farm',
      fallback: 'Grow',
      url: '/farm',
      icon: 'grow',
    },
    {
      name: 'Texts.sidebar-proposals',
      fallback: 'Bots',
      url: '/proposals',
      icon: 'bots',
    },
    {
      name: 'Texts.sidebar-history',
      fallback: 'History',
      url: '/history',
      icon: 'history',
    },
    {
      name: 'Texts.sidebar-settings',
      fallback: 'Settings',
      url: '/profile',
      icon: 'settings',
    },
    {
      name: 'Texts.sidebar-security',
      fallback: 'Security',
      url: '/profile',
      icon: 'security',
    },
    {
      name: 'Texts.sidebar-website',
      fallback: 'Craftscript.com',
      href: environment.origin,
      icon: 'external',
    },
    {
      name: 'Texts.sidebar-docs',
      fallback: 'Docs',
      href: 'https://docs.craftscript.com/',
      icon: 'docs',
    },
  ];

  private readonly moreSectionUrls = [
    '/farm',
    '/proposals',
    '/history',
    '/profile',
  ];

  private routerSubscription?: Subscription;
  private menuSubscription?: Subscription;

  constructor(
    private readonly localizedRouting: LocalizedRoutingService,
    private readonly router: Router,
    private readonly navMenu: MobileNavMenuService
  ) {
    this.menuOpen = this.navMenu.isOpen;
    this.menuSubscription = this.navMenu.open$.subscribe(open => {
      this.menuOpen = open;
      if (!open) {
        this.moreOpen = false;
      }
    });
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.closeMenu());
  }

  public ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.menuSubscription?.unsubscribe();
  }

  public trackById(index: number): number {
    return index;
  }

  public stagger(index: number): string {
    return `${index * 30}ms`;
  }

  public path(url: string): string {
    return this.localizedRouting.path(url);
  }

  public toggleMenu(): void {
    if (this.menuOpen) {
      this.closeMenu();
      return;
    }

    this.moreOpen = false;
    this.navMenu.open();
  }

  public closeMenu(): void {
    this.navMenu.close();
  }

  public openMore(): void {
    this.navMenu.open();
    this.moreOpen = true;
  }

  public closeMore(): void {
    this.moreOpen = false;
  }

  public onRailClick(): void {
    if (this.moreOpen) {
      this.closeMore();
      return;
    }

    this.closeMenu();
  }

  public isMoreActive(): boolean {
    if (this.moreOpen) {
      return true;
    }

    const path = stripLocalePrefix(this.router.url).split(/[?#]/)[0];
    return this.moreSectionUrls.includes(path);
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    if (!this.menuOpen) {
      return;
    }

    if (this.moreOpen) {
      this.closeMore();
      return;
    }

    this.closeMenu();
  }
}
