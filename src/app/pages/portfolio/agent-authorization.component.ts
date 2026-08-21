import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { PortfolioApiService } from './portfolio-api.service';
import { AgentAuthorizationRequest } from './portfolio.models';

@Component({
  selector: 'app-agent-authorization',
  standalone: false,
  template: `
    <main class="authorization-page">
      <section class="authorization-card">
        <p class="authorization-card__eyebrow">AI agent access</p>
        @if (loading) {
          <h1>Checking request…</h1>
        } @else if (request) {
          <h1>Allow {{ request.clientName }} to view your portfolio?</h1>
          <p>
            This agent runs using your provider account. CraftScript does not
            receive its login or model-provider credentials.
          </p>
          <ul>
            @for (scope of request.scopes; track scope) {
              <li>{{ scopeLabel(scope) }}</li>
            }
          </ul>
          <p class="authorization-card__note">
            Read-only access lasts for up to {{ grantLifetimeDays }} days unless
            you revoke it. The agent cannot trade, move funds, or view your
            account login details.
          </p>
          <div class="authorization-card__actions">
            <button
              mat-stroked-button
              [disabled]="busy"
              (click)="decide('deny')">
              Deny
            </button>
            <button
              mat-flat-button
              color="primary"
              [disabled]="busy"
              (click)="decide('approve')">
              Allow access
            </button>
          </div>
        } @else {
          <h1>This authorization request is unavailable</h1>
          <p>{{ error }}</p>
        }
      </section>
    </main>
  `,
  styleUrls: ['./agent-authorization.component.scss'],
})
export class AgentAuthorizationComponent implements OnInit {
  request?: AgentAuthorizationRequest;
  grantLifetimeDays?: number;
  loading = true;
  busy = false;
  error = 'It may have expired or already been used.';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: PortfolioApiService,
    private readonly events: ProductEventsService
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.queryParamMap.get('transaction');
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
      this.loading = false;
      return;
    }
    history.replaceState({}, document.title, location.pathname);
    try {
      const [request, config] = await Promise.all([
        this.api.loadAuthorization(id),
        this.api.loadAgentConfig(),
      ]);
      if (
        !config.enabled ||
        !Number.isInteger(config.grantLifetimeDays) ||
        config.grantLifetimeDays <= 0
      ) {
        throw new Error('Agent access is not available.');
      }
      this.request = request;
      this.grantLifetimeDays = config.grantLifetimeDays;
    } catch {
      this.request = undefined;
      this.grantLifetimeDays = undefined;
    } finally {
      this.loading = false;
    }
  }

  scopeLabel(scope: string): string {
    const labels: Record<string, string> = {
      'portfolio:read': 'View balances, allocation, and price timestamps',
      'investment_profile:read':
        'View your objective, risk tolerance, and horizon',
      offline_access: `Reconnect for up to ${this.grantLifetimeDays} days unless you revoke access`,
    };
    return labels[scope] ?? scope;
  }

  async decide(decision: 'approve' | 'deny'): Promise<void> {
    if (!this.request) return;
    this.busy = true;
    try {
      const continueUrl = await this.api.decideAuthorization(
        this.request.id,
        decision
      );
      if (!this.api.isTrustedContinuation(continueUrl)) {
        throw new Error('The authorization continuation is not trusted.');
      }
      window.location.assign(continueUrl);
    } catch (error) {
      this.events.recordFailure('agent.authorization', error, {
        metadata: { decision },
      });
      this.error = 'Authorization could not be completed.';
      this.request = undefined;
      this.busy = false;
    }
  }
}
