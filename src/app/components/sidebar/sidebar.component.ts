import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import {
  LocalizedRoutingService,
  stripLocalePrefix,
} from '@core/routing/localized-routing.service';

const SIDEBAR_LINE_COUNT = 6;
const SIDEBAR_LINE_DURATION_MS = 500;
const SIDEBAR_LINE_FALLBACK_MS = SIDEBAR_LINE_DURATION_MS + 200;

export interface SidebarLink {
  name: string;
  fallback: string;
  url: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrls: ['sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  public readonly lineCount = SIDEBAR_LINE_COUNT;
  public readonly lineIndexes = Array.from(
    { length: SIDEBAR_LINE_COUNT },
    (_, index) => index
  ).slice(1, -1);
  public readonly lineDurationSeconds = SIDEBAR_LINE_DURATION_MS / 1000;

  public menuReady = false;
  public lineResetKey = 0;

  public readonly menuItems: SidebarLink[] = [
    {
      name: 'Texts.sidebar-portfolio',
      fallback: 'Portfolio',
      url: '/portfolio',
    },
    {
      name: 'Texts.sidebar-trade',
      fallback: 'Trade',
      url: '/',
    },
    {
      name: 'Texts.sidebar-transactions',
      fallback: 'Transactions',
      url: '/transactions',
    },
  ];

  private animationFallbackId: ReturnType<typeof setTimeout> | null = null;
  private routerSubscription?: Subscription;
  private lastAnimatedUrl: string | null = null;
  private hasCompletedInitialAnimation = false;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private readonly router: Router,
    public readonly localizedRouting: LocalizedRoutingService
  ) {}

  public ngOnInit(): void {
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
        this.replayAnimation();
      });

    this.startAnimation();
  }

  public ngOnDestroy(): void {
    this.clearAnimationFallback();
    this.routerSubscription?.unsubscribe();
  }

  public lineTo(index: number): string {
    return `calc(${index} * (100% - 1px) / ${this.lineCount - 1})`;
  }

  public trackById(index: number): number {
    return index;
  }

  public onLineAnimationEnd(index: number, play = this.lineResetKey): void {
    if (play !== this.lineResetKey) {
      return;
    }

    if (index !== this.lineIndexes[this.lineIndexes.length - 1]) {
      return;
    }

    this.revealMenu();
  }

  public replayAnimation(): void {
    this.startAnimation(true);
  }

  public revealMenu(): void {
    if (this.menuReady) {
      return;
    }

    this.menuReady = true;
    this.hasCompletedInitialAnimation = true;
    this.clearAnimationFallback();
  }

  private startAnimation(resetLines = false): void {
    if (this.prefersReducedMotion()) {
      this.menuReady = true;
      return;
    }

    this.menuReady = false;
    this.clearAnimationFallback();

    if (resetLines) {
      this.lineResetKey += 1;
    }

    this.animationFallbackId = setTimeout(() => {
      this.revealMenu();
    }, SIDEBAR_LINE_FALLBACK_MS);
  }

  private prefersReducedMotion(): boolean {
    return (
      this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)')
        .matches ?? false
    );
  }

  private clearAnimationFallback(): void {
    if (this.animationFallbackId === null) {
      return;
    }

    clearTimeout(this.animationFallbackId);
    this.animationFallbackId = null;
  }

  private navigationKey(url: string): string {
    return stripLocalePrefix(url).split(/[?#]/)[0];
  }
}
