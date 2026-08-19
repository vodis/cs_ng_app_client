import { Component, OnInit } from '@angular/core';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { PortfolioApiService } from './portfolio-api.service';
import {
  AgentAuthorizationRequest,
  AgentConnection,
  AgentIntegrationConfig,
  InvestmentHorizon,
  InvestmentObjective,
  InvestmentProfile,
  PortfolioSnapshot,
  RiskTolerance,
} from './portfolio.models';

@Component({
  selector: 'app-portfolio',
  standalone: false,
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss'],
})
export class PortfolioComponent implements OnInit {
  portfolio?: PortfolioSnapshot;
  profile?: InvestmentProfile;
  config?: AgentIntegrationConfig;
  connections: AgentConnection[] = [];
  loading = true;
  error = '';
  actionError = '';
  profileOpen = false;
  agentOpen = false;
  savingProfile = false;
  revokingId = '';
  copying = false;
  deviceCode = '';
  deviceLoading = false;
  pendingAuthorization?: AgentAuthorizationRequest;
  authorizationLoading = false;

  objective: InvestmentObjective = 'growth';
  riskTolerance: RiskTolerance = 'balanced';
  horizon: InvestmentHorizon = '3_5y';

  constructor(
    private readonly api: PortfolioApiService,
    private readonly events: ProductEventsService
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    const [portfolio, profile, config] = await Promise.allSettled([
      this.api.loadPortfolio(),
      this.api.loadInvestmentProfile(),
      this.api.loadAgentConfig(),
    ]);

    if (portfolio.status === 'fulfilled') this.portfolio = portfolio.value;
    if (profile.status === 'fulfilled') this.applyProfile(profile.value);
    if (config.status === 'fulfilled') {
      this.config = config.value;
      if (config.value.enabled) await this.reloadConnections();
    }
    if (portfolio.status === 'rejected') {
      this.error = 'Portfolio data is temporarily unavailable.';
    }
    this.loading = false;
  }

  openProfile(): void {
    if (this.profile) this.applyProfile(this.profile);
    this.actionError = '';
    this.profileOpen = true;
  }

  async saveProfile(): Promise<void> {
    this.savingProfile = true;
    this.actionError = '';
    try {
      this.applyProfile(
        await this.api.saveInvestmentProfile({
          objective: this.objective,
          riskTolerance: this.riskTolerance,
          horizon: this.horizon,
        })
      );
      this.profileOpen = false;
    } catch (error) {
      this.actionError = this.message(error, 'Could not save preferences.');
    } finally {
      this.savingProfile = false;
    }
  }

  openAgent(): void {
    this.actionError = '';
    this.deviceCode = '';
    this.pendingAuthorization = undefined;
    this.agentOpen = true;
  }

  async copyMcpUrl(): Promise<void> {
    if (!this.config?.mcpUrl) return;
    this.copying = true;
    try {
      await navigator.clipboard.writeText(this.config.mcpUrl);
    } finally {
      window.setTimeout(() => (this.copying = false), 1200);
    }
  }

  async findDeviceCode(): Promise<void> {
    const code = this.deviceCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) {
      this.actionError = 'Enter the 8-character code shown by your agent.';
      return;
    }
    this.deviceLoading = true;
    this.actionError = '';
    try {
      this.pendingAuthorization = await this.api.resolveDeviceCode(code);
    } catch (error) {
      this.actionError = this.message(error, 'The code is invalid or expired.');
    } finally {
      this.deviceLoading = false;
    }
  }

  async decide(decision: 'approve' | 'deny'): Promise<void> {
    if (!this.pendingAuthorization) return;
    this.authorizationLoading = true;
    this.actionError = '';
    this.events.record({
      eventName: 'agent.authorization',
      status: 'attempted',
      metadata: { decision },
    });
    try {
      const continueUrl = await this.api.decideAuthorization(
        this.pendingAuthorization.id,
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
      this.actionError = this.message(
        error,
        'Authorization could not be completed.'
      );
      this.authorizationLoading = false;
    }
  }

  async revoke(connection: AgentConnection): Promise<void> {
    this.revokingId = connection.id;
    this.actionError = '';
    try {
      await this.api.revokeConnection(connection.id);
      await this.reloadConnections();
    } catch (error) {
      this.actionError = this.message(
        error,
        'Could not revoke this connection.'
      );
    } finally {
      this.revokingId = '';
    }
  }

  private async reloadConnections(): Promise<void> {
    try {
      this.connections = await this.api.loadConnections();
    } catch {
      this.connections = [];
    }
  }

  private applyProfile(profile: InvestmentProfile): void {
    this.profile = profile;
    this.objective = profile.objective;
    this.riskTolerance = profile.riskTolerance;
    this.horizon = profile.horizon;
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
