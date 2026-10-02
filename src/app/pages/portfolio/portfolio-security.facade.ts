import { Injectable } from '@angular/core';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';

@Injectable()
export class PortfolioSecurityFacade {
  public readonly session$ = this.authSession.session$;
  public readonly loading$ = this.authSession.loading$;

  constructor(private readonly authSession: AuthSessionService) {}

  public get passkeyLinkEnabled(): boolean {
    return this.authSession.passkeyLinkEnabled;
  }

  public get passkeyLoginEnabled(): boolean {
    return this.authSession.passkeyLoginEnabled;
  }

  public enablePasskey(): Promise<AuthSession> {
    return this.authSession.enablePasskey();
  }
}
