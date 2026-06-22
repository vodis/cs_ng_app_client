import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { filter, Subscription } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  public currentWidth = window.innerWidth;
  public isMobileView = false;
  public originUrl: string = environment.origin;
  public horizontalLineAnimating = true;
  public lineResetKey = 0;
  public session: AuthSession | null = null;

  private routerSubscription?: Subscription;
  private sessionSubscription?: Subscription;

  constructor(
    private readonly router: Router,
    public readonly authSession: AuthSessionService
  ) {}

  public ngOnInit(): void {
    this.isMobileView = this.currentWidth <= 768;

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.horizontalLineAnimating = true;
        this.lineResetKey += 1;
      });

    this.sessionSubscription = this.authSession.session$.subscribe(session => {
      this.session = session;
    });
  }

  public ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.sessionSubscription?.unsubscribe();
  }

  @HostListener('window:resize', ['$event'])
  public onResize(event: Event): void {
    this.currentWidth = (
      event as unknown as { target: Window }
    ).target.innerWidth;
    this.isMobileView = this.currentWidth <= 768;
  }

  public onHorizontalLineAnimationComplete(): void {
    this.horizontalLineAnimating = false;
  }
}
