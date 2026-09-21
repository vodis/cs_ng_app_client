/// <reference types="jasmine" />

import { of } from 'rxjs';
import { AccountSessionsComponent } from './account-sessions.component';
import { AccountSessionsFacade } from './account-sessions.facade';

describe('AccountSessionsComponent', () => {
  let component: AccountSessionsComponent;
  let account: jasmine.SpyObj<AccountSessionsFacade>;

  beforeEach(() => {
    account = jasmine.createSpyObj<AccountSessionsFacade>(
      'AccountSessionsFacade',
      ['requestDeletion', 'logout'],
      {
        loading$: of(false),
      }
    );
    component = new AccountSessionsComponent(account);
  });

  it('shows two sessions by default and the rest after See all', () => {
    expect(component.visibleLoginSessions.length).toBe(2);

    component.toggleSessions();

    expect(component.visibleLoginSessions.length).toBe(
      component.loginSessions.length
    );
    expect(component.showAllSessions).toBeTrue();
  });

  it('routes logout and deletion through the account facade', async () => {
    account.logout.and.resolveTo();
    account.requestDeletion.and.resolveTo('2026-10-01T00:00:00.000Z');

    await component.logout();
    await component.requestDeletion();

    expect(account.logout).toHaveBeenCalledTimes(1);
    expect(account.requestDeletion).toHaveBeenCalledTimes(1);
    expect(component.deletionMessage).toContain('Deletion available');
  });
});
