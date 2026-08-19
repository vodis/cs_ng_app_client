import { ProductEventsService } from '@core/product-events/product-events.service';
import { PortfolioApiService } from './portfolio-api.service';
import { PortfolioComponent } from './portfolio.component';

describe('PortfolioComponent', () => {
  let api: jasmine.SpyObj<PortfolioApiService>;
  let events: jasmine.SpyObj<ProductEventsService>;
  let component: PortfolioComponent;

  beforeEach(() => {
    api = jasmine.createSpyObj<PortfolioApiService>('PortfolioApiService', [
      'loadPortfolio',
      'loadInvestmentProfile',
      'loadAgentConfig',
      'loadConnections',
      'saveInvestmentProfile',
      'resolveDeviceCode',
      'decideAuthorization',
      'revokeConnection',
      'isTrustedContinuation',
    ]);
    events = jasmine.createSpyObj<ProductEventsService>(
      'ProductEventsService',
      ['record', 'recordFailure']
    );
    api.loadPortfolio.and.resolveTo({
      asOf: '2026-08-19T12:00:00Z',
      valuationCurrency: 'USD',
      totalValue: '100',
      unpricedPositionCount: 0,
      positions: [
        {
          walletRef: 'opaque-wallet',
          chain: 'near',
          assetId: 'near',
          symbol: 'NEAR',
          quantity: '20',
          priceUsd: '5',
          valueUsd: '100',
          allocationPercent: '100.00',
          priceUpdatedAt: '2026-08-19T12:00:00Z',
          balanceUpdatedAt: '2026-08-19T12:00:00Z',
        },
      ],
    });
    api.loadInvestmentProfile.and.resolveTo({
      objective: 'growth',
      riskTolerance: 'balanced',
      horizon: '3_5y',
      updatedAt: '2026-08-19T12:00:00Z',
    });
    api.loadAgentConfig.and.resolveTo({
      enabled: true,
      mcpUrl: 'https://api.craftscript.com/mcp',
      testedClients: ['ChatGPT', 'Codex'],
      grantLifetimeDays: 30,
    });
    api.loadConnections.and.resolveTo([]);
    component = new PortfolioComponent(api, events);
  });

  it('loads portfolio, preferences, capability, and connections', async () => {
    await component.load();

    expect(component.portfolio?.totalValue).toBe('100');
    expect(component.profile?.riskTolerance).toBe('balanced');
    expect(api.loadConnections).toHaveBeenCalledTimes(1);
    expect(component.loading).toBeFalse();
  });

  it('does not submit malformed device codes', async () => {
    component.deviceCode = 'bad';
    await component.findDeviceCode();

    expect(api.resolveDeviceCode).not.toHaveBeenCalled();
    expect(component.actionError).toContain('8-character');
  });

  it('saves only the fixed investment preference fields', async () => {
    api.saveInvestmentProfile.and.resolveTo({
      objective: 'income',
      riskTolerance: 'conservative',
      horizon: '1_3y',
      updatedAt: '2026-08-19T13:00:00Z',
    });
    component.objective = 'income';
    component.riskTolerance = 'conservative';
    component.horizon = '1_3y';

    await component.saveProfile();

    expect(api.saveInvestmentProfile).toHaveBeenCalledOnceWith({
      objective: 'income',
      riskTolerance: 'conservative',
      horizon: '1_3y',
    });
    expect(component.profileOpen).toBeFalse();
  });
});
