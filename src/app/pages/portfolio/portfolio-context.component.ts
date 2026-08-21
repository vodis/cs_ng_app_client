import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  AgentConnection,
  AgentIntegrationConfig,
  InvestmentProfile,
} from './portfolio.models';

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

  label(value: string | undefined): string {
    if (!value) return 'Not set';
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  date(value: string): string {
    return new Date(value).toLocaleString();
  }

  trackConnection(_index: number, item: AgentConnection): string {
    return item.id;
  }
}
