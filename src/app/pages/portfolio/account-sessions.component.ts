import { Component } from '@angular/core';

export type AccountLoginSession = {
  id: string;
  status: 'Active' | 'Expired' | 'Revoked';
  issued: string;
  endDate: string;
  endDateIso: string;
  organization: string;
  authentication: string;
  application: string;
  currentDevice: boolean;
};

/** Demo rows — status/currentDevice are authoritative; do not re-derive from Date.now(). */
export const MOCK_LOGIN_SESSIONS: AccountLoginSession[] = [
  {
    id: 'session-current',
    status: 'Active',
    issued: 'Nov 11, 2026, 11:56 AM',
    endDate: 'Nov 18, 2026, 11:56 AM',
    endDateIso: '2026-11-18T11:56:00.000Z',
    organization: 'CraftScript',
    authentication: 'Google OAuth',
    application: 'CraftScript App',
    currentDevice: true,
  },
  {
    id: 'session-revoked',
    status: 'Revoked',
    issued: 'Aug 13, 2026, 11:23 AM',
    endDate: 'Aug 20, 2026, 11:23 AM',
    endDateIso: '2026-08-20T11:23:00.000Z',
    organization: '137372',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
    currentDevice: false,
  },
  {
    id: 'session-expired',
    status: 'Expired',
    issued: 'Aug 12, 2026, 6:41 PM',
    endDate: 'Aug 19, 2026, 6:41 PM',
    endDateIso: '2026-08-19T18:41:00.000Z',
    organization: 'CraftScript',
    authentication: 'Google OAuth',
    application: 'NEAR Intents Partner Portal',
    currentDevice: false,
  },
];

/**
 * Optional client-side expiry check for Active rows. Callers must pass a
 * controlled `now` in tests; production UI should prefer authoritative status.
 */
export function normalizeAccountLoginSession(
  session: AccountLoginSession,
  now: number
): AccountLoginSession {
  if (session.status !== 'Active') {
    return session;
  }

  const end = Date.parse(session.endDateIso);
  if (!Number.isNaN(end) && end < now) {
    return { ...session, status: 'Expired', currentDevice: false };
  }

  return session;
}

@Component({
  selector: 'app-account-sessions',
  standalone: false,
  templateUrl: './account-sessions.component.html',
  styleUrls: ['./account-sessions.component.scss'],
})
export class AccountSessionsComponent {
  public error = '';
  public showAllSessions = false;
  public loginSessions = MOCK_LOGIN_SESSIONS.map(session => ({ ...session }));
  public visibleLoginSessions = this.loginSessions.slice(0, 2);

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
    return login.id;
  }

  public canRevoke(login: AccountLoginSession): boolean {
    return login.status === 'Active' && !login.currentDevice;
  }

  public confirmRevoke(login: AccountLoginSession): void {
    if (!this.canRevoke(login)) {
      return;
    }

    const confirmed = window.confirm(
      `Revoke the session issued ${login.issued}? You will need to sign in again on that device.`
    );
    if (!confirmed) {
      return;
    }

    this.loginSessions = this.loginSessions.map(session =>
      session.id === login.id
        ? { ...session, status: 'Revoked' as const, currentDevice: false }
        : session
    );
    this.visibleLoginSessions = this.showAllSessions
      ? this.loginSessions
      : this.loginSessions.slice(0, 2);
  }
}
