import { Component, OnDestroy, OnInit } from '@angular/core';
import type { AuthSession } from '@core/auth/auth-session.types';
import { Subscription } from 'rxjs';
import { PortfolioSecurityFacade } from './portfolio-security.facade';

@Component({
  selector: 'app-portfolio-security',
  standalone: false,
  templateUrl: './portfolio-security.component.html',
  styleUrls: ['./portfolio-security.component.scss'],
  providers: [PortfolioSecurityFacade],
})
export class PortfolioSecurityComponent implements OnInit, OnDestroy {
  public session: AuthSession | null = null;
  public passkeyLoading = false;
  public message = '';
  public error = '';

  private readonly subscriptions = new Subscription();

  constructor(private readonly security: PortfolioSecurityFacade) {}

  public ngOnInit(): void {
    this.subscriptions.add(
      this.security.session$.subscribe(session => {
        this.session = session;
      })
    );
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  public get passkeyEnabled(): boolean {
    return this.session?.user.passkeyEnabled === true;
  }

  public get canEnablePasskey(): boolean {
    return this.security.passkeyLinkEnabled;
  }

  public get passkeyLoginAvailable(): boolean {
    return this.security.passkeyLoginEnabled;
  }

  public get passkeyStatusLabel(): string {
    if (this.passkeyEnabled) {
      return this.passkeyLoginAvailable
        ? 'Enabled for sign-in'
        : 'Linked (sign-in not available yet)';
    }
    return this.canEnablePasskey ? 'Not enabled' : 'Unavailable';
  }

  public async enablePasskey(): Promise<void> {
    this.error = '';
    this.message = '';
    this.passkeyLoading = true;
    try {
      await this.security.enablePasskey();
      this.message = 'Passkey authentication enabled.';
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Passkey enablement failed';
    } finally {
      this.passkeyLoading = false;
    }
  }

  public disablePasskey(): void {
    this.error = '';
    this.message =
      'Passkey unlink is not available in the app yet. Sign in with another method if you need to rotate credentials, then add a new passkey.';
  }

  public recoverPasskey(): void {
    this.error = '';
    this.message =
      'If you lose this passkey, sign in with Google, Apple, Telegram, or email, then enable a new passkey from this page.';
  }
}
