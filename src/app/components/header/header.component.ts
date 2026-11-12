import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { MobileNavMenuService } from '@components/mobile-bottom-nav/mobile-nav-menu.service';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
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
  public menuOpen = false;

  @ViewChild('menuTrigger')
  private menuTrigger?: ElementRef<HTMLButtonElement>;

  private sessionSubscription?: Subscription;
  private menuSubscription?: Subscription;
  private focusSubscription?: Subscription;

  @HostBinding('class.header-host--mobile')
  get hostMobile(): boolean {
    return this.isMobileView;
  }

  constructor(
    public readonly authSession: AuthSessionService,
    public readonly localizedRouting: LocalizedRoutingService,
    private readonly mobileNavMenu: MobileNavMenuService,
    private readonly walletsService: WalletsService
  ) {}

  public ngOnInit(): void {
    this.isMobileView = this.currentWidth <= 768;

    this.sessionSubscription = this.authSession.session$.subscribe(session => {
      this.session = session;
    });

    this.menuSubscription = this.mobileNavMenu.open$.subscribe(open => {
      this.menuOpen = open;
    });

    this.focusSubscription = this.mobileNavMenu.focusTrigger$.subscribe(() => {
      this.menuTrigger?.nativeElement.focus();
    });
  }

  public ngOnDestroy(): void {
    this.sessionSubscription?.unsubscribe();
    this.menuSubscription?.unsubscribe();
    this.focusSubscription?.unsubscribe();
  }

  public openWallets(): void {
    this.walletsService.requestOpen();
  }

  public toggleMobileMenu(): void {
    this.mobileNavMenu.toggle();
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
