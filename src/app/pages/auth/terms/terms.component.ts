import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '@core/auth/auth-session.service';
import {
  CURRENT_TERMS_VERSION,
  TERMS_DOCUMENT_PARAGRAPHS,
} from '@core/auth/terms-acceptance.constants';
import { TermsAcceptanceService } from '@core/auth/terms-acceptance.service';
import { LocalizedRoutingService } from '@core/routing/localized-routing.service';
import { authPageTransition } from '../shared/auth-page.animations';
import { readReturnUrl } from '../shared/auth-navigation.helper';

@Component({
  selector: 'app-terms',
  standalone: false,
  templateUrl: './terms.component.html',
  styleUrls: ['./terms.component.scss'],
  animations: [authPageTransition],
})
export class TermsComponent implements AfterViewInit {
  @ViewChild('termsBody')
  private readonly termsBody?: ElementRef<HTMLElement>;

  public readonly paragraphs = TERMS_DOCUMENT_PARAGRAPHS;
  public readonly termsVersion = CURRENT_TERMS_VERSION;
  public canAgree = false;
  public accepting = false;
  public loggingOut = false;

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly termsAcceptance: TermsAcceptanceService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly localizedRouting: LocalizedRoutingService
  ) {}

  public get title(): string {
    const userId = this.authSession.session?.user.id;
    if (userId && this.termsAcceptance.isVersionUpdate(userId)) {
      return 'Our Terms of Service have changed';
    }
    return 'Terms and Conditions';
  }

  public ngAfterViewInit(): void {
    queueMicrotask(() => this.refreshScrollState());
  }

  public onTermsScroll(): void {
    this.refreshScrollState();
  }

  public async agree(): Promise<void> {
    const userId = this.authSession.session?.user.id;
    if (!userId || !this.canAgree || this.accepting) {
      return;
    }

    this.accepting = true;
    try {
      this.termsAcceptance.acceptCurrent(userId);
      await this.router.navigateByUrl(
        this.localizedRouting.path(
          readReturnUrl(this.route.snapshot.queryParamMap)
        )
      );
    } finally {
      this.accepting = false;
    }
  }

  public async logout(): Promise<void> {
    if (this.loggingOut) {
      return;
    }
    this.loggingOut = true;
    try {
      await this.authSession.logout();
    } finally {
      this.loggingOut = false;
    }
  }

  private refreshScrollState(): void {
    const el = this.termsBody?.nativeElement;
    if (!el) {
      return;
    }

    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= 8) {
      this.canAgree = true;
      return;
    }

    const remaining = overflow - el.scrollTop;
    if (remaining <= 8) {
      this.canAgree = true;
    }
  }
}
