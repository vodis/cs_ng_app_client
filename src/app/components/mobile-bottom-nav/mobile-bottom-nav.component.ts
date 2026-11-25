import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import {
  CsTranslationsService,
  type CsLanguageCode,
} from '@vodis/cs-foundation/angular';
import {
  LOCALE_SLUGS,
  LocaleSlug,
  LocalizedRoutingService,
  localeSlugToLanguage,
  localizedPath,
  stripLocalePrefix,
} from '@core/routing/localized-routing.service';
import { ClientRpcFacade } from '@domains/rpc/client-rpc.facade';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { environment } from '../../../environments/environment';
import { MobileNavMenuService } from './mobile-nav-menu.service';

export type MobileNavItem = {
  name: string;
  fallback: string;
  url?: string;
  href?: string;
  exact?: boolean;
  /** Draw a subtle divider under this item (e.g. after Bots). */
  dividerAfter?: boolean;
};

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: false,
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: [
    './mobile-bottom-nav.component.scss',
    './mobile-bottom-nav-panel.component.scss',
  ],
})
export class MobileBottomNavComponent implements OnInit, OnDestroy {
  public menuOpen = false;

  public readonly locales = LOCALE_SLUGS;

  /** Flat destinations — replaces the old Exchange / Profile / More popup. */
  public readonly links: MobileNavItem[] = [
    {
      name: 'Texts.sidebar-swap',
      fallback: 'Exchange',
      url: '/',
      exact: true,
    },
    {
      name: 'Texts.sidebar-profile',
      fallback: 'Profile',
      url: '/profile',
      exact: true,
    },
    {
      name: 'Texts.sidebar-transactions',
      fallback: 'Transactions',
      url: '/transactions',
    },
    {
      name: 'Texts.sidebar-portfolio',
      fallback: 'Portfolio',
      url: '/portfolio',
    },
    {
      name: 'Texts.sidebar-farm',
      fallback: 'Grow',
      url: '/farm',
    },
    {
      name: 'Texts.sidebar-proposals',
      fallback: 'Bots',
      url: '/proposals',
      dividerAfter: true,
    },
    {
      name: 'Texts.sidebar-website',
      fallback: 'Craftscript.com',
      href: environment.origin,
    },
    {
      name: 'Texts.sidebar-docs',
      fallback: 'Docs',
      href: 'https://docs.craftscript.com/',
    },
  ];

  private routerSubscription?: Subscription;
  private menuSubscription?: Subscription;
  private walletsOpenSubscription?: Subscription;

  public readonly rpcSettingsOpen$ = this.clientRpc.settingsOpen$;

  constructor(
    private readonly clientRpc: ClientRpcFacade,
    private readonly localizedRouting: LocalizedRoutingService,
    private readonly mobileNavMenu: MobileNavMenuService,
    private readonly router: Router,
    private readonly translations: CsTranslationsService,
    private readonly walletsService: WalletsService
  ) {}

  public ngOnInit(): void {
    this.menuSubscription = this.mobileNavMenu.open$.subscribe(open => {
      this.menuOpen = open;
    });

    // Wallet dialog is a foreground layer; close nav so drawers do not stack.
    this.walletsOpenSubscription = this.walletsService.openRequested
      .pipe(filter(openRequested => openRequested))
      .subscribe(() => {
        if (this.menuOpen) {
          this.closeMenu();
        }
      });

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.closeMenu());
  }

  public ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.menuSubscription?.unsubscribe();
    this.walletsOpenSubscription?.unsubscribe();
    this.mobileNavMenu.close();
  }

  public trackById(index: number): number {
    return index;
  }

  public stagger(index: number): string {
    return `${40 + index * 35}ms`;
  }

  public path(url: string): string {
    return this.localizedRouting.path(url);
  }

  public currentLocale(): LocaleSlug {
    return this.localizedRouting.currentLocale();
  }

  public localeLabel(locale: LocaleSlug): string {
    return locale.toUpperCase();
  }

  public isActiveLink(item: MobileNavItem): boolean {
    if (!item.url) {
      return false;
    }

    const path = stripLocalePrefix(this.router.url).split(/[?#]/)[0] || '/';
    if (item.exact) {
      return path === item.url;
    }

    return path === item.url || path.startsWith(`${item.url}/`);
  }

  public toggleMenu(): void {
    this.mobileNavMenu.toggle();
  }

  public closeMenu(restoreTriggerFocus = false): void {
    this.mobileNavMenu.close(restoreTriggerFocus);
  }

  public closeRpcSettings(): void {
    this.clientRpc.closeSettings();
  }

  public async selectLocale(locale: LocaleSlug): Promise<void> {
    if (locale === this.currentLocale()) {
      return;
    }

    const language = localeSlugToLanguage(locale) as CsLanguageCode;
    await firstValueFrom(this.translations.loadLanguage(language)).catch(
      () => undefined
    );

    try {
      window.localStorage.setItem('active-language', language);
    } catch {
      // Ignore storage failures (private mode).
    }

    const unprefixed = stripLocalePrefix(this.router.url);
    await this.router.navigateByUrl(localizedPath(unprefixed, locale));
  }

  public internalDestinations(): string[] {
    return this.links
      .map(item => item.url)
      .filter((url): url is string => !!url);
  }
}
