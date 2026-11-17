import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { isAuthShellRoute } from '@core/routing/auth-shell.routes';

@Component({
  selector: 'app-layout',
  standalone: false,
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit, OnDestroy {
  public currentWidth = window.innerWidth;
  public isMobileView = false;
  public hideShell = isAuthShellRoute(window.location.pathname);

  private routerSubscription?: Subscription;

  constructor(private readonly router: Router) {}

  public ngOnInit(): void {
    this.isMobileView = this.currentWidth <= 768;

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => {
        this.updateShellVisibility(event.urlAfterRedirects);
      });
  }

  public ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  @HostListener('window:resize', ['$event'])
  public onResize(event: Event): void {
    this.currentWidth = (
      event as unknown as { target: Window }
    ).target.innerWidth;
    this.isMobileView = this.currentWidth <= 768;
  }

  private updateShellVisibility(url: string): void {
    this.hideShell = isAuthShellRoute(url);
  }
}
