import {
  Component,
  HostBinding,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  public currentWidth = window.innerWidth;
  public isMobileView = false;
  public horizontalLineAnimating = true;
  public session: AuthSession | null = null;

  private sessionSubscription?: Subscription;

  @HostBinding('class.header-host--mobile')
  get hostMobile(): boolean {
    return this.isMobileView;
  }

  constructor(
    public readonly authSession: AuthSessionService,
    public readonly localizedRouting: LocalizedRoutingService
  ) {}

  public ngOnInit(): void {
    this.isMobileView = this.currentWidth <= 768;

    this.sessionSubscription = this.authSession.session$.subscribe(session => {
      this.session = session;
    });
  }

  public ngOnDestroy(): void {
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
