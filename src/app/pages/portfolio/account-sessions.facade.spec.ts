/// <reference types="jasmine" />

import { of } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { AccountSessionsFacade } from './account-sessions.facade';

describe('AccountSessionsFacade', () => {
  let facade: AccountSessionsFacade;
  let authSession: jasmine.SpyObj<AuthSessionService>;

  beforeEach(() => {
    authSession = jasmine.createSpyObj<AuthSessionService>(
      'AuthSessionService',
      ['requestDeletion', 'logout'],
      {
        loading$: of(false),
      }
    );
    facade = new AccountSessionsFacade(authSession);
  });

  it('exposes loading$ from the auth session service', done => {
    facade.loading$.subscribe(loading => {
      expect(loading).toBeFalse();
      done();
    });
  });

  it('delegates logout and requestDeletion to the auth session service', async () => {
    authSession.logout.and.resolveTo();
    authSession.requestDeletion.and.resolveTo('2026-10-01T00:00:00.000Z');

    await facade.logout();
    await expectAsync(facade.requestDeletion()).toBeResolvedTo(
      '2026-10-01T00:00:00.000Z'
    );

    expect(authSession.logout).toHaveBeenCalledTimes(1);
    expect(authSession.requestDeletion).toHaveBeenCalledTimes(1);
  });
});
