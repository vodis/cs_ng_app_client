import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductEventsService } from '@core/product-events/product-events.service';
import {
  agentDisplayName,
  isHttpsUri,
  isVerifiedAgentClient,
} from './agent-authorization-display.utils';
import { PortfolioApiService } from './portfolio-api.service';
import { AgentAuthorizationRequest } from './portfolio.models';

@Component({
  selector: 'app-agent-authorization',
  standalone: false,
  templateUrl: './agent-authorization.component.html',
  styleUrls: ['./agent-authorization.component.scss'],
})
export class AgentAuthorizationComponent implements OnInit {
  request?: AgentAuthorizationRequest;
  grantLifetimeDays?: number;
  loading = true;
  busy = false;
  logoFailed = false;
  error = 'It may have expired or already been used.';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: PortfolioApiService,
    private readonly events: ProductEventsService
  ) {}

  get displayName(): string {
    return this.request ? agentDisplayName(this.request) : 'Unknown client';
  }

  get verified(): boolean {
    return this.request ? isVerifiedAgentClient(this.request) : false;
  }

  get verifiedHostLabel(): string | null {
    const host = this.request?.clientHost?.trim();
    return host || null;
  }

  get logoUrl(): string | null {
    const value = this.request?.logoUri;
    return isHttpsUri(value) ? value.trim() : null;
  }

  get clientLink(): string | null {
    const value = this.request?.clientUri;
    return isHttpsUri(value) ? value.trim() : null;
  }

  get loopback(): boolean {
    return this.request?.loopbackRedirect === true;
  }

  get redirectHost(): string | null {
    const host = this.request?.redirectHost?.trim();
    return host || null;
  }

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
      this.logoFailed = false;
    } catch {
      this.request = undefined;
      this.grantLifetimeDays = undefined;
    } finally {
      this.loading = false;
    }
  }

  onLogoError(): void {
    this.logoFailed = true;
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
