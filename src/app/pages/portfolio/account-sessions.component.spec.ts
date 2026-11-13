/// <reference types="jasmine" />

import {
  AccountSessionsComponent,
  MOCK_LOGIN_SESSIONS,
  normalizeAccountLoginSession,
} from './account-sessions.component';

describe('AccountSessionsComponent', () => {
  let component: AccountSessionsComponent;

  beforeEach(() => {
    component = new AccountSessionsComponent();
  });

  it('shows two sessions by default and the rest after See all', () => {
    expect(component.visibleLoginSessions.length).toBe(2);

    component.toggleSessions();

    expect(component.visibleLoginSessions.length).toBe(
      component.loginSessions.length
    );
    expect(component.showAllSessions).toBeTrue();
  });

  it('marks the current device and keeps its status Active when still valid', () => {
    const current = component.loginSessions.find(
      session => session.currentDevice
    );

    expect(current).toBeTruthy();
    expect(current?.status).toBe('Active');
    expect(component.canRevoke(current!)).toBeFalse();
  });

  it('revokes other active sessions after confirmation', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const target = {
      id: 'session-other-active',
      status: 'Active' as const,
      issued: 'Nov 10, 2026, 9:00 AM',
      endDate: 'Nov 20, 2026, 9:00 AM',
      endDateIso: '2099-11-20T09:00:00.000Z',
      organization: 'CraftScript',
      authentication: 'Google OAuth',
      application: 'CraftScript App',
      currentDevice: false,
    };
    component.loginSessions = [component.loginSessions[0], target];
    component.visibleLoginSessions = component.loginSessions;

    component.confirmRevoke(target);

    expect(
      component.loginSessions.find(session => session.id === target.id)?.status
    ).toBe('Revoked');
  });

  it('keeps authoritative Expired status from session data', () => {
    const expired = component.loginSessions.find(
      session => session.id === 'session-expired'
    );
    expect(expired?.status).toBe('Expired');
  });
});

describe('normalizeAccountLoginSession', () => {
  const clock = Date.parse('2026-11-12T12:00:00.000Z');

  it('keeps the current-device mock Active when the clock is before endDateIso', () => {
    const current = MOCK_LOGIN_SESSIONS.find(
      session => session.id === 'session-current'
    )!;

    const normalized = normalizeAccountLoginSession(current, clock);

    expect(normalized.status).toBe('Active');
    expect(normalized.currentDevice).toBeTrue();
  });

  it('marks past-dated Active sessions Expired against a controlled clock', () => {
    const activePastEnd = {
      ...MOCK_LOGIN_SESSIONS[0],
      id: 'session-active-past',
      endDateIso: '2026-11-11T11:00:00.000Z',
      currentDevice: true,
    };

    const normalized = normalizeAccountLoginSession(activePastEnd, clock);

    expect(normalized.status).toBe('Expired');
    expect(normalized.currentDevice).toBeFalse();
  });

  it('does not rewrite non-Active authoritative status', () => {
    const expired = MOCK_LOGIN_SESSIONS.find(
      session => session.id === 'session-expired'
    )!;

    expect(normalizeAccountLoginSession(expired, clock)).toEqual(expired);
  });
});
