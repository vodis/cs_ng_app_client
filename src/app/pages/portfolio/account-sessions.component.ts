import { Component } from '@angular/core';
import { AuthSessionService } from '@core/auth/auth-session.service';

type AccountLoginSession = {
  status: 'Active' | 'Revoked';
  issued: string;
  endDate: string;
  organization: string;
  authentication: string;
  application: string;
};

const MOCK_LOGIN_SESSIONS: AccountLoginSession[] = [
  {
    status: 'Active',
    issued: 'Aug 13, 2026, 11:56 AM',
    endDate: 'Aug 20, 2026, 11:56 AM',
    organization: 'CraftScript',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
  },
  {
    status: 'Revoked',
    issued: 'Aug 13, 2026, 11:23 AM',
    endDate: 'Aug 20, 2026, 11:23 AM',
    organization: '137372',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
  },
  {
    status: 'Revoked',
    issued: 'Aug 12, 2026, 6:41 PM',
    endDate: 'Aug 19, 2026, 6:41 PM',
    organization: 'CraftScript',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
  },
];

@Component({
  selector: 'app-account-sessions',
  standalone: false,
  templateUrl: './account-sessions.component.html',
})
export class AccountSessionsComponent {
  public deletionMessage = '';
  public error = '';
  public showAllSessions = false;
  public readonly loginSessions = MOCK_LOGIN_SESSIONS;
  public visibleLoginSessions = MOCK_LOGIN_SESSIONS.slice(0, 2);
  public readonly loading$ = this.authSession.loading$;

  constructor(private readonly authSession: AuthSessionService) {}

  public toggleSessions(): void {
    this.showAllSessions = !this.showAllSessions;
    this.visibleLoginSessions = this.showAllSessions
      ? this.loginSessions
      : this.loginSessions.slice(0, 2);
  }

  public trackByLoginSession(
    _index: number,
    login: AccountLoginSession
  ): string {
    return [login.status, login.issued, login.organization].join('|');
  }

  public async requestDeletion(): Promise<void> {
    this.error = '';
    this.deletionMessage = '';
    try {
      const deletionAvailableAt = await this.authSession.requestDeletion();
      this.deletionMessage = `Deletion available ${new Date(deletionAvailableAt).toLocaleDateString()}`;
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Account deletion failed';
    }
  }

  public async logout(): Promise<void> {
    this.error = '';
    this.deletionMessage = '';
    try {
      await this.authSession.logout();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Logout failed';
    }
  }
}
