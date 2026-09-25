import { Injectable } from '@angular/core';
import { AuthSessionService } from '@core/auth/auth-session.service';

@Injectable()
export class AccountSessionsFacade {
  public readonly loading$ = this.authSession.loading$;

  constructor(private readonly authSession: AuthSessionService) {}

  public requestDeletion(): Promise<string> {
    return this.authSession.requestDeletion();
  }

  public logout(): Promise<void> {
    return this.authSession.logout();
  }
}
