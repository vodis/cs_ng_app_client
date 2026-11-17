import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import {
  CsTranslationsService,
  type CsLanguageCode,
} from '@vodis/cs-foundation/angular';
import { AuthSessionService } from '@core/auth/auth-session.service';
import {
  LOCALE_SLUGS,
  LocaleSlug,
  LocalizedRoutingService,
  localeSlugToLanguage,
  localizedPath,
  stripLocalePrefix,
} from '@core/routing/localized-routing.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { environment } from '../../../environments/environment';
import { MobileNavMenuService } from './mobile-nav-menu.service';

export type MobileNavItem = {
  name: string;
  fallback: string;
  url?: string;
  href?: string;
  exact?: boolean;
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

  @ViewChild('slideNav')
  private slideNav?: ElementRef<HTMLElement>;

  @HostBinding('class.menu-open')
  get hostMenuOpen(): boolean {
    return this.menuOpen;
  }

  private routerSubscription?: Subscription;
  private menuSubscription?: Subscription;
  private walletsOpenSubscription?: Subscription;
  private previousBodyOverflow = '';
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly authSession: AuthSessionService,
    private readonly localizedRouting: LocalizedRoutingService,
    private readonly mobileNavMenu: MobileNavMenuService,
    private readonly router: Router,
    private readonly translations: CsTranslationsService,
    private readonly walletsService: WalletsService
  ) {}

  public ngOnInit(): void {
    this.menuSubscription = this.mobileNavMenu.open$.subscribe(open => {
      const wasOpen = this.menuOpen;
      this.menuOpen = open;
      this.syncBodyScrollLock(open);

      if (open && !wasOpen) {
        this.focusFirstItem();
      }
    });

    // Wallet dialog is a foreground layer; close nav so its document Tab trap
    // cannot yank focus back to header controls behind the dialog.
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
    this.syncBodyScrollLock(false);
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

  public async logout(): Promise<void> {
    this.closeMenu();
    await this.authSession.logout();
  }

  public internalDestinations(): string[] {
    return this.links
      .map(item => item.url)
      .filter((url): url is string => !!url);
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    if (!this.menuOpen) {
      return;
    }

    this.closeMenu(true);
  }

  @HostListener('document:keydown', ['$event'])
  public onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.menuOpen || event.key !== 'Tab') {
      return;
    }

    const active = this.document.activeElement as HTMLElement | null;
    // Suspend while a foreground dialog (wallet drawer, side modal) owns focus.
    if (active && this.isForegroundDialogFocus(active)) {
      return;
    }

    const focusable = this.focusScopeElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const index = active ? focusable.indexOf(active) : -1;

    // Keep Tab inside panel + visible header controls (close / wallets / account).
    if (index === -1) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (event.shiftKey && index === 0) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && index === focusable.length - 1) {
      event.preventDefault();
      first.focus();
    }
  }

  public onTouchStart(event: TouchEvent): void {
    if (!this.menuOpen || event.touches.length !== 1) {
      return;
    }

    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
  }

  public onTouchEnd(event: TouchEvent): void {
    if (
      !this.menuOpen ||
      this.touchStartX === null ||
      this.touchStartY === null ||
      event.changedTouches.length !== 1
    ) {
      this.touchStartX = null;
      this.touchStartY = null;
      return;
    }

    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const deltaX = endX - this.touchStartX;
    const deltaY = Math.abs(endY - this.touchStartY);
    this.touchStartX = null;
    this.touchStartY = null;

    // Swipe right to close (panel exits to the right).
    if (deltaX > 72 && deltaX > deltaY * 1.4) {
      this.closeMenu(true);
    }
  }

  private syncBodyScrollLock(locked: boolean): void {
    const body = this.document.body;
    if (locked) {
      this.previousBodyOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
      return;
    }

    body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = '';
  }

  private focusFirstItem(): void {
    queueMicrotask(() => {
      const root = this.slideNav?.nativeElement;
      if (!root) {
        return;
      }

      // Open into the panel; Shift+Tab still reaches header controls via focus scope.
      this.focusableElements(root)[0]?.focus();
    });
  }

  private isForegroundDialogFocus(active: HTMLElement): boolean {
    const dialog = active.closest('[role="dialog"], [aria-modal="true"]');
    if (!(dialog instanceof HTMLElement)) {
      return false;
    }

    const panel = this.slideNav?.nativeElement;
    const headerControls = this.document.querySelector(
      'app-header .header__content_connect'
    );
    if (panel?.contains(dialog)) {
      return false;
    }
    if (
      headerControls instanceof HTMLElement &&
      headerControls.contains(dialog)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Visible mobile chrome while the drawer is open: header actions stay above
   * the panel and must remain in the Tab cycle with the panel content.
   */
  private focusScopeElements(): HTMLElement[] {
    const headerControls = this.document.querySelector(
      'app-header .header__content_connect'
    );
    const panel = this.slideNav?.nativeElement;
    const nodes: HTMLElement[] = [];

    if (headerControls instanceof HTMLElement) {
      nodes.push(...this.focusableElements(headerControls));
    }
    if (panel) {
      nodes.push(...this.focusableElements(panel));
    }

    return Array.from(new Set(nodes)).sort((left, right) => {
      const position = left.compareDocumentPosition(right);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }
      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }
      return 0;
    });
  }

  private focusableElements(root: HTMLElement): HTMLElement[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);
  }
}
