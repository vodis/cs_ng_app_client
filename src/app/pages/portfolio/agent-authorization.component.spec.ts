import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ProductEventsService } from '@core/product-events/product-events.service';
import { AgentAuthorizationComponent } from './agent-authorization.component';
import { PortfolioApiService } from './portfolio-api.service';
import type { AgentAuthorizationRequest } from './portfolio.models';

describe('AgentAuthorizationComponent', () => {
  function createComponent(
    request: AgentAuthorizationRequest,
    grantLifetimeDays = 45
  ): AgentAuthorizationComponent {
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
    api.loadAuthorization.and.resolveTo(request);
    api.loadAgentConfig.and.resolveTo({
      enabled: true,
      mcpUrl: 'https://api.craftscript.com/mcp',
      testedClients: ['Codex'],
      grantLifetimeDays,
    });
    const events = jasmine.createSpyObj<ProductEventsService>(
      'ProductEventsService',
      ['recordFailure']
    );
    return new AgentAuthorizationComponent(route, api, events);
  }

  it('uses the configured grant lifetime instead of the request expiry', async () => {
    const component = createComponent({
      id: '00000000-0000-4000-8000-000000000000',
      clientName: 'Test agent',
      scopes: ['portfolio:read', 'offline_access'],
      expiresAt: '2026-08-21T12:10:00Z',
    });

    await component.ngOnInit();

    expect(component.grantLifetimeDays).toBe(45);
    expect(component.scopeLabel('offline_access')).toContain('45 days');
  });

  it('shows verified identity details for metadata-document clients', async () => {
    const component = createComponent({
      id: '00000000-0000-4000-8000-000000000000',
      clientName: 'ChatGPT',
      clientHost: 'chatgpt.com',
      clientUri: 'https://chatgpt.com',
      logoUri: 'https://cdn.example/logo.png',
      redirectHost: 'chatgpt.com',
      clientVerification: 'metadata_document',
      loopbackRedirect: false,
      scopes: ['portfolio:read'],
      expiresAt: '2026-08-21T12:10:00Z',
    });

    await component.ngOnInit();

    expect(component.displayName).toBe('ChatGPT');
    expect(component.verified).toBeTrue();
    expect(component.verifiedHostLabel).toBe('chatgpt.com');
    expect(component.logoUrl).toBe('https://cdn.example/logo.png');
    expect(component.clientLink).toBe('https://chatgpt.com');
    expect(component.loopback).toBeFalse();
  });

  it('degrades safely when new identity fields are null', async () => {
    const component = createComponent({
      id: '00000000-0000-4000-8000-000000000000',
      clientName: 'Legacy agent',
      clientHost: null,
      clientUri: null,
      logoUri: null,
      redirectHost: null,
      clientVerification: null,
      loopbackRedirect: null,
      scopes: ['portfolio:read'],
      expiresAt: '2026-08-21T12:10:00Z',
    });

    await component.ngOnInit();

    expect(component.displayName).toBe('Legacy agent');
    expect(component.verified).toBeFalse();
    expect(component.logoUrl).toBeNull();
    expect(component.clientLink).toBeNull();
    expect(component.loopback).toBeFalse();
    expect(component.redirectHost).toBeNull();
  });

  it('falls back to host when clientName is empty and marks loopback', async () => {
    const component = createComponent({
      id: '00000000-0000-4000-8000-000000000000',
      clientName: '',
      clientHost: '127.0.0.1',
      redirectHost: '127.0.0.1:8787',
      clientVerification: 'unverified',
      loopbackRedirect: true,
      scopes: ['portfolio:read'],
      expiresAt: '2026-08-21T12:10:00Z',
    });

    await component.ngOnInit();

    expect(component.displayName).toBe('127.0.0.1');
    expect(component.verified).toBeFalse();
    expect(component.loopback).toBeTrue();
    expect(component.redirectHost).toBe('127.0.0.1:8787');
  });

  it('hides a broken logo without throwing', async () => {
    const component = createComponent({
      id: '00000000-0000-4000-8000-000000000000',
      clientName: 'ChatGPT',
      logoUri: 'https://cdn.example/broken.png',
      clientVerification: 'first_party',
      scopes: ['portfolio:read'],
      expiresAt: '2026-08-21T12:10:00Z',
    });

    await component.ngOnInit();
    expect(component.logoUrl).toBe('https://cdn.example/broken.png');

    component.onLogoError();
    expect(component.logoFailed).toBeTrue();
  });
});
