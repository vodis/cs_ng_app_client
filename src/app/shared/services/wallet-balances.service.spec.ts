import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import { environment } from '../../../environments/environment';
import { WalletBalancesService } from './wallet-balances.service';

describe('WalletBalancesService', () => {
  let httpMock: HttpTestingController;
  let service: WalletBalancesService;
  let authProvider: jasmine.SpyObj<AuthProviderService>;

  beforeEach(() => {
    authProvider = jasmine.createSpyObj<AuthProviderService>(
      'AuthProviderService',
      ['whenSettled', 'getAccessToken']
    );
    authProvider.whenSettled.and.resolveTo({
      status: 'ready',
      loginMethods: [],
      passkeyLoginEnabled: false,
      passkeySignupEnabled: false,
      passkeyLinkEnabled: false,
      embeddedWalletEnabled: false,
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        WalletBalancesService,
        { provide: AuthProviderService, useValue: authProvider },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WalletBalancesService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads filtered balances using the provider access token', fakeAsync(() => {
    authProvider.getAccessToken.and.resolveTo('provider-token');
    let result: unknown;

    service
      .loadBalances({
        walletAddress: 'alice.testnet',
        network: 'near:testnet',
        assetIds: ['nep141:wrap.testnet', 'nep141:usdc.testnet'],
      })
      .subscribe(balances => {
        result = balances;
      });
    tick();

    const request = httpMock.expectOne(`${environment.apiUrl}/api/v1/balances`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer provider-token'
    );
    expect(request.request.body).toEqual({
      walletAddress: 'alice.testnet',
      network: 'near:testnet',
      assetIds: ['nep141:wrap.testnet', 'nep141:usdc.testnet'],
    });

    request.flush({ data: [] });
    expect(result).toEqual([]);
  }));

  it('accepts an explicitly unlinked read-only balance', fakeAsync(() => {
    authProvider.getAccessToken.and.resolveTo('provider-token');
    let result: unknown;

    service
      .loadBalances({
        walletAddress: '0x1111111111111111111111111111111111111111',
        network: 'eip155:1',
      })
      .subscribe(balances => {
        result = balances;
      });
    tick();

    const request = httpMock.expectOne(`${environment.apiUrl}/api/v1/balances`);
    request.flush({
      data: [
        {
          walletId: null,
          walletAddress: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          network: 'eip155:1',
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          balanceRaw: '1',
          balanceDecimal: '0.000000000000000001',
          source: 'rpc_batch',
          fetchedAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-01-01T00:01:00Z',
          stale: false,
        },
      ],
    });

    expect(result).toEqual([
      jasmine.objectContaining({
        walletId: null,
        network: 'eip155:1',
        assetId: 'eth',
      }),
    ]);
  }));

  it('preserves partial response metadata', fakeAsync(() => {
    authProvider.getAccessToken.and.resolveTo('provider-token');
    let result: unknown;

    service.loadBalancesWithMeta().subscribe(value => (result = value));
    tick();

    const request = httpMock.expectOne(`${environment.apiUrl}/api/v1/balances`);
    request.flush({ data: [], meta: { partial: true } });

    expect(result).toEqual({ balances: [], partial: true });
  }));

  it('waits for provider initialization before requesting a token', fakeAsync(() => {
    let settleProvider: (() => void) | undefined;
    authProvider.whenSettled.and.returnValue(
      new Promise(resolve => {
        settleProvider = () =>
          resolve({
            status: 'ready',
            loginMethods: [],
            passkeyLoginEnabled: false,
            passkeySignupEnabled: false,
            passkeyLinkEnabled: false,
            embeddedWalletEnabled: false,
          });
      })
    );
    authProvider.getAccessToken.and.resolveTo('provider-token');

    service.loadBalances().subscribe();
    tick();
    expect(authProvider.getAccessToken).not.toHaveBeenCalled();

    settleProvider?.();
    tick();
    expect(authProvider.getAccessToken).toHaveBeenCalledTimes(1);

    const request = httpMock.expectOne(`${environment.apiUrl}/api/v1/balances`);
    request.flush({ data: [] });
  }));

  it('rejects rows that omit network provenance', fakeAsync(() => {
    authProvider.getAccessToken.and.resolveTo('provider-token');
    let error: unknown;

    service.loadBalances().subscribe({ error: value => (error = value) });
    tick();

    const request = httpMock.expectOne(`${environment.apiUrl}/api/v1/balances`);
    request.flush({
      data: [
        {
          walletId: null,
          walletAddress: '0x1111111111111111111111111111111111111111',
          chainType: 'ethereum',
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          balanceRaw: '1',
          balanceDecimal: null,
          source: 'rpc_batch',
          fetchedAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-01-01T00:01:00Z',
          stale: false,
        },
      ],
    });

    expect(error).toEqual(jasmine.any(Error));
  }));
});
