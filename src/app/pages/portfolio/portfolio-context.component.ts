import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  AgentConnection,
  AgentIntegrationConfig,
  InvestmentProfile,
} from './portfolio.models';
import {
  expiresWithinDays,
  investmentHorizonLabel,
  investmentObjectiveLabel,
  relativeExpiryLabel,
  riskToleranceLabel,
} from './portfolio-display.utils';

@Component({
  selector: 'app-portfolio-context',
  standalone: false,
  templateUrl: './portfolio-context.component.html',
  styleUrls: ['./portfolio-context.component.scss'],
})
export class PortfolioContextComponent {
  @Input() profile?: InvestmentProfile;
  @Input() config?: AgentIntegrationConfig;
  @Input() connections: AgentConnection[] = [];
  @Input() connectionsLoading = false;
  @Input() connectionsLoaded = false;
  @Input() connectionsError = '';
  @Input() revokingId = '';

  @Output() editProfile = new EventEmitter<void>();
  @Output() connectAgent = new EventEmitter<void>();
  @Output() retryConnections = new EventEmitter<void>();
  @Output() revokeAgent = new EventEmitter<AgentConnection>();

  public objectiveLabel(): string {
    return investmentObjectiveLabel(this.profile?.objective);
  }

  public riskLabel(): string {
    return riskToleranceLabel(this.profile?.riskTolerance);
  }

  public horizonLabel(): string {
    return investmentHorizonLabel(this.profile?.horizon);
  }

  public expiryLabel(value: string): string {
    return relativeExpiryLabel(value);
  }

  public expiryTitle(value: string): string {
    return new Date(value).toLocaleString();
  }

  public expiresSoon(value: string): boolean {
    return expiresWithinDays(value, 7);
  }

  public confirmRevoke(connection: AgentConnection): void {
    const confirmed = window.confirm(
      `Revoke read-only access for ${connection.clientName}? This agent will lose portfolio access immediately.`
    );
    if (!confirmed) {
      return;
    }
    this.revokeAgent.emit(connection);
  }

  public trackConnection(_index: number, item: AgentConnection): string {
    return item.id;
  }
}
