import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import {
  LocalizedRoutingService,
  stripLocalePrefix,
} from '@core/routing/localized-routing.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';

/** Icons fade in after the intro line sweep (~420ms) settles. */
const RAIL_ICON_REVEAL_MS = 480;
/** Short opacity pulse on in-app navigations. */
const RAIL_NAV_MS = 220;

export type SidebarIcon =
  | 'profile'
  | 'trade'
  | 'transactions'
  | 'portfolio'
  | 'notifications'
  | 'wallets';

export interface SidebarLink {
  name: string;
  fallback: string;
  url: string;
  icon: SidebarIcon;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  /** Line is animating from left → right edge on first paint. */
  public lineSweeping = false;
  /** Line parked at the rail edge; icons may reveal. */
  public lineSettled = false;
  /** Icons stay in the DOM from first paint; this only toggles visual reveal. */
  public iconsVisible = false;
  public navPulse = false;
  public session: AuthSession | null = null;

  public readonly menuItems: SidebarLink[] = [
    {
      name: 'Texts.sidebar-profile',
      fallback: 'Profile',
      url: '/profile',
      icon: 'profile',
      exact: true,
    },
    {
      name: 'Texts.sidebar-trade',
      fallback: 'Trade',
      url: '/',
      icon: 'trade',
      exact: true,
    },
    {
      name: 'Texts.sidebar-transactions',
      fallback: 'Transactions',
      url: '/transactions',
      icon: 'transactions',
    },
    {
      name: 'Texts.sidebar-portfolio',
      fallback: 'Portfolio',
      url: '/portfolio',
      icon: 'portfolio',
    },
  ];

  private introTimer: ReturnType<typeof setTimeout> | null = null;
  private navTimer: ReturnType<typeof setTimeout> | null = null;
  private routerSubscription?: Subscription;
  private sessionSubscription?: Subscription;
  private lastAnimatedUrl: string | null = null;
  private hasCompletedInitialAnimation = false;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly authSession: AuthSessionService,
    private readonly router: Router,
    private readonly walletsService: WalletsService,
    public readonly localizedRouting: LocalizedRoutingService
  ) {}

  public ngOnInit(): void {
    this.sessionSubscription = this.authSession.session$.subscribe(session => {
      this.session = session;
    });

    this.routerSubscription = this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        )
      )
      .subscribe(event => {
        const url = this.navigationKey(event.urlAfterRedirects);

        if (!this.hasCompletedInitialAnimation) {
          this.lastAnimatedUrl = url;
          return;
        }

        if (url === this.lastAnimatedUrl) {
          return;
        }

        this.lastAnimatedUrl = url;
        this.pulseOnNavigate();
      });

    this.startIntroAnimation();
  }

  public ngOnDestroy(): void {
    this.clearIntroTimer();
    this.clearNavTimer();
    this.routerSubscription?.unsubscribe();
    this.sessionSubscription?.unsubscribe();
  }

  public trackById(index: number): number {
    return index;
  }

  public stagger(index: number): string {
    return `${index * 40}ms`;
  }

  public path(url: string): string {
    return this.localizedRouting.path(url);
  }

  public avatarTitle(): string {
    const email = this.session?.user.email?.trim();
    return email || 'Account';
  }

  public isProfileRoute(): boolean {
    return this.navigationKey(this.router.url) === '/profile';
  }

  public isActive(item: SidebarLink): boolean {
    const current = this.navigationKey(this.router.url);
    if (item.exact) {
      return current === item.url;
    }
    return current === item.url || current.startsWith(`${item.url}/`);
  }

  public openWallets(): void {
    this.walletsService.requestOpen();
  }

  public matIcon(icon: SidebarIcon): string {
    switch (icon) {
      case 'profile':
        return 'person';
      case 'trade':
        return 'swap_horiz';
      case 'transactions':
        return 'history';
      case 'portfolio':
        return 'pie_chart';
      case 'notifications':
        return 'notifications';
      case 'wallets':
        return 'account_balance_wallet';
    }
  }

  private startIntroAnimation(): void {
    if (this.prefersReducedMotion()) {
      this.lineSweeping = false;
      this.lineSettled = true;
      this.iconsVisible = true;
      this.hasCompletedInitialAnimation = true;
      this.lastAnimatedUrl = this.navigationKey(this.router.url);
      return;
    }

    this.lineSweeping = true;
    this.lineSettled = false;
    this.iconsVisible = false;
    this.clearIntroTimer();
    this.introTimer = setTimeout(() => {
      this.lineSweeping = false;
      this.lineSettled = true;
      this.iconsVisible = true;
      this.hasCompletedInitialAnimation = true;
      this.lastAnimatedUrl = this.navigationKey(this.router.url);
    }, RAIL_ICON_REVEAL_MS);
  }

  private pulseOnNavigate(): void {
    if (this.prefersReducedMotion()) {
      return;
    }

    // Restart opacity pulse without touching the settled transform.
    this.navPulse = false;
    this.clearNavTimer();
    // Force a class toggle so the opacity animation can replay.
    this.navTimer = setTimeout(() => {
      this.navPulse = true;
      this.navTimer = setTimeout(() => {
        this.navPulse = false;
        this.navTimer = null;
      }, RAIL_NAV_MS);
    }, 0);
  }

  private prefersReducedMotion(): boolean {
    return (
      this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
        .matches ?? false
    );
  }

  private clearIntroTimer(): void {
    if (this.introTimer !== null) {
      clearTimeout(this.introTimer);
      this.introTimer = null;
    }
  }

  private clearNavTimer(): void {
    if (this.navTimer !== null) {
      clearTimeout(this.navTimer);
      this.navTimer = null;
    }
  }

  private navigationKey(url: string): string {
    return stripLocalePrefix(url).split(/[?#]/)[0] || '/';
  }
}
