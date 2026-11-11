/// <reference types="jasmine" />

import { AccountSessionsComponent } from './account-sessions.component';

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

  it('normalizes past-dated Active sessions to Expired', () => {
    const expired = component.loginSessions.find(
      session => session.id === 'session-expired'
    );
    expect(expired?.status).toBe('Expired');
  });
});
