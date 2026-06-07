import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Direction } from '@shared/components/animate-line/animate-line.component';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: false,
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('contentRouter', { read: ElementRef })
  private contentRouter?: ElementRef<HTMLElement>;

  public currentWidth = window.innerWidth;
  public isMobileView = false;
  public DirectionType = Direction;
  public verticalLineAnimating = true;
  public contentHeight: number | null = null;
  public lineResetKey = 0;

  private resizeObserver?: ResizeObserver;
  private routerSubscription?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly ngZone: NgZone
  ) {}

  public ngOnInit(): void {
    this.isMobileView = this.currentWidth <= 768;

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.verticalLineAnimating = true;
        this.lineResetKey += 1;
        this.updateContentHeight();
      });
  }

  public ngAfterViewInit(): void {
    if (!this.contentRouter || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.ngZone.run(() => this.updateContentHeight());
    });
    this.resizeObserver.observe(this.contentRouter.nativeElement);
    this.updateContentHeight();
  }

  public ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.routerSubscription?.unsubscribe();
  }

  @HostListener('window:resize', ['$event'])
  public onResize(event: Event): void {
    this.currentWidth = (
      event as unknown as { target: Window }
    ).target.innerWidth;
    this.isMobileView = this.currentWidth <= 768;
    this.updateContentHeight();
  }

  public onVerticalLineAnimationComplete(): void {
    this.verticalLineAnimating = false;
    this.updateContentHeight();
  }

  public get verticalLineHeight(): string {
    if (this.verticalLineAnimating) {
      return 'calc(100vh - 4rem)';
    }

    return this.contentHeight
      ? `${this.contentHeight}px`
      : 'calc(100vh - 4rem)';
  }

  private updateContentHeight(): void {
    if (!this.contentRouter) {
      return;
    }

    this.contentHeight = this.contentRouter.nativeElement.offsetHeight;
  }
}
