/// <reference types="jasmine" />

import { of } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AccountSessionsComponent } from './account-sessions.component';

describe('AccountSessionsComponent', () => {
  let component: AccountSessionsComponent;
  let authSession: jasmine.SpyObj<AuthSessionService>;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['requestDeletion', 'logout'],
      {
        loading$: of(false),
      }
    );
    component = new AccountSessionsComponent(authSession);
  });

  it('shows two sessions by default and the rest after See all', () => {
    expect(component.visibleLoginSessions.length).toBe(2);

    component.toggleSessions();

    expect(component.visibleLoginSessions.length).toBe(
      component.loginSessions.length
    );
    expect(component.showAllSessions).toBeTrue();
  });
});
