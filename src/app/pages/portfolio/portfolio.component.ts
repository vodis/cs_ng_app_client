import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { AccountSessionsFacade } from './account-sessions.facade';
import { PortfolioApiService } from './portfolio-api.service';
import {
  AgentAuthorizationRequest,
  AgentConnection,
  AgentIntegrationConfig,
  InvestmentHorizon,
  InvestmentObjective,
  InvestmentProfile,
  RiskTolerance,
} from './portfolio.models';

@Component({
  selector: 'app-portfolio',
  standalone: false,
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss'],
  providers: [AccountSessionsFacade],
})
export class PortfolioComponent implements OnInit {
  profile?: InvestmentProfile;
  config?: AgentIntegrationConfig;
  connections: AgentConnection[] = [];
  connectionsLoading = false;
  connectionsLoaded = false;
  connectionsError = '';
  loading = true;
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
  deleteConfirmText = '';
  deletionMessage = '';
  accountError = '';

  objective: InvestmentObjective = 'growth';
  riskTolerance: RiskTolerance = 'balanced';
  horizon: InvestmentHorizon = '3_5y';

  public readonly accountLoading$ = this.account.loading$;

  constructor(
    private readonly api: PortfolioApiService,
    private readonly events: ProductEventsService,
    private readonly route: ActivatedRoute,
    private readonly account: AccountSessionsFacade
  ) {}

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('connect') === 'device') {
      this.openAgent();
    }
    void this.load().then(() => this.scrollToRouteFragment());
  }

  /**
   * Keep in-page section jumps on /…/portfolio#id instead of resolving bare
   * href="#id" against the app base (often /#id).
   */
  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    this.scrollToId(sectionId, true);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.actionError = '';
    const [profile, config] = await Promise.allSettled([
      this.api.loadInvestmentProfile(),
      this.api.loadAgentConfig(),
    ]);

    if (profile.status === 'fulfilled') this.applyProfile(profile.value);
    if (config.status === 'fulfilled') {
      this.config = config.value;
      if (config.value.enabled) await this.reloadConnections();
    }
    this.loading = false;
  }

  private scrollToRouteFragment(): void {
    const fragment = this.route.snapshot.fragment;
    if (!fragment) {
      return;
    }
    // Wait a tick so *ngIf sections exist after loading finishes.
    queueMicrotask(() => this.scrollToId(fragment, false));
  }

  private scrollToId(sectionId: string, updateUrl: boolean): void {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!updateUrl) {
      return;
    }
    const next = `${window.location.pathname}${window.location.search}#${sectionId}`;
    window.history.replaceState(null, '', next);
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
      this.connections = this.connections.filter(
        candidate => candidate.id !== connection.id
      );
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

  async reloadConnections(): Promise<void> {
    this.connectionsLoading = true;
    this.connectionsError = '';
    try {
      const connections = await this.api.loadConnections();
      this.connections = connections.filter(
        connection => connection.status === 'active'
      );
      this.connectionsLoaded = true;
    } catch {
      this.connectionsLoaded = false;
      this.connectionsError =
        'Connected-agent status is temporarily unavailable.';
    } finally {
      this.connectionsLoading = false;
    }
  }

  public async logout(): Promise<void> {
    this.accountError = '';
    this.deletionMessage = '';
    try {
      await this.account.logout();
    } catch (error) {
      this.accountError =
        error instanceof Error ? error.message : 'Logout failed';
    }
  }

  public async requestDeletion(): Promise<void> {
    if (this.deleteConfirmText !== 'DELETE') {
      return;
    }

    this.accountError = '';
    this.deletionMessage = '';
    try {
      const deletionAvailableAt = await this.account.requestDeletion();
      this.deletionMessage = `Deletion available ${new Date(deletionAvailableAt).toLocaleDateString()}`;
      this.deleteConfirmText = '';
    } catch (error) {
      this.accountError =
        error instanceof Error ? error.message : 'Account deletion failed';
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
