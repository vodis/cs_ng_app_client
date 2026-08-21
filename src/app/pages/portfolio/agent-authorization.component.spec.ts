import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { AgentAuthorizationComponent } from './agent-authorization.component';
import { PortfolioApiService } from './portfolio-api.service';

describe('AgentAuthorizationComponent', () => {
  it('uses the configured grant lifetime instead of the request expiry', async () => {
    const route = {
      snapshot: {
        queryParamMap: convertToParamMap({
          transaction: '00000000-0000-4000-8000-000000000000',
        }),
      },
    } as unknown as ActivatedRoute;
    const api = jasmine.createSpyObj<PortfolioApiService>(
      'PortfolioApiService',
      ['loadAuthorization', 'loadAgentConfig']
    );
    api.loadAuthorization.and.resolveTo({
      id: '00000000-0000-4000-8000-000000000000',
      clientName: 'Test agent',
      scopes: ['portfolio:read', 'offline_access'],
      expiresAt: '2026-08-21T12:10:00Z',
    });
    api.loadAgentConfig.and.resolveTo({
      enabled: true,
      mcpUrl: 'https://api.craftscript.com/mcp',
      testedClients: ['Codex'],
      grantLifetimeDays: 45,
    });
    const events = jasmine.createSpyObj<ProductEventsService>(
      'ProductEventsService',
      ['recordFailure']
    );
    const component = new AgentAuthorizationComponent(route, api, events);

    await component.ngOnInit();

    expect(component.grantLifetimeDays).toBe(45);
    expect(component.scopeLabel('offline_access')).toContain('45 days');
  });
});
