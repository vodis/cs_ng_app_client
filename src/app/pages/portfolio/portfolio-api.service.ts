import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import {
  AgentAuthorizationRequest,
  AgentConnection,
  AgentIntegrationConfig,
  InvestmentProfile,
  PortfolioSnapshot,
} from './portfolio.models';

@Injectable()
export class PortfolioApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly authProvider: AuthProviderService
  ) {}

  async loadPortfolio(): Promise<PortfolioSnapshot> {
    return firstValueFrom(
      this.http.get<PortfolioSnapshot>(
        `${environment.apiUrl}/api/v1/portfolio`,
        {
          headers: await this.headers(),
        }
      )
    );
  }

  async loadInvestmentProfile(): Promise<InvestmentProfile> {
    return firstValueFrom(
      this.http.get<InvestmentProfile>(
        `${environment.apiUrl}/api/v1/investment-profile`,
        { headers: await this.headers() }
      )
    );
  }

  async saveInvestmentProfile(
    profile: Omit<InvestmentProfile, 'updatedAt'>
  ): Promise<InvestmentProfile> {
    return firstValueFrom(
      this.http.put<InvestmentProfile>(
        `${environment.apiUrl}/api/v1/investment-profile`,
        profile,
        { headers: await this.headers() }
      )
    );
  }

  async loadAgentConfig(): Promise<AgentIntegrationConfig> {
    return firstValueFrom(
      this.http.get<AgentIntegrationConfig>(
        `${environment.apiUrl}/api/v1/agent-integrations/config`,
        { headers: await this.headers() }
      )
    );
  }

  async loadConnections(): Promise<AgentConnection[]> {
    const response = await firstValueFrom(
      this.http.get<{ connections: AgentConnection[] }>(
        `${environment.apiUrl}/api/v1/agent-connections`,
        { headers: await this.headers() }
      )
    );
    return response.connections;
  }

  async revokeConnection(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiUrl}/api/v1/agent-connections/${id}`, {
        headers: await this.headers(),
      })
    );
  }

  async loadAuthorization(id: string): Promise<AgentAuthorizationRequest> {
    return firstValueFrom(
      this.http.get<AgentAuthorizationRequest>(
        `${environment.apiUrl}/api/v1/agent-authorizations/${id}`,
        { headers: await this.headers() }
      )
    );
  }

  async resolveDeviceCode(code: string): Promise<AgentAuthorizationRequest> {
    return firstValueFrom(
      this.http.post<AgentAuthorizationRequest>(
        `${environment.apiUrl}/api/v1/agent-authorizations/device-code`,
        { userCode: code },
        { headers: await this.headers() }
      )
    );
  }

  async decideAuthorization(
    id: string,
    decision: 'approve' | 'deny'
  ): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<{ continueUrl: string }>(
        `${environment.apiUrl}/api/v1/agent-authorizations/${id}/${decision}`,
        {},
        { headers: await this.headers() }
      )
    );
    return response.continueUrl;
  }

  isTrustedContinuation(value: string): boolean {
    try {
      const url = new URL(value);
      return [environment.apiUrl, environment.origin].some(origin => {
        const allowed = new URL(origin);
        return url.origin === allowed.origin;
      });
    } catch {
      return false;
    }
  }

  private async headers(): Promise<HttpHeaders> {
    const token = await this.authProvider.getAccessToken();
    if (!token) {
      throw new Error('No active session');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
